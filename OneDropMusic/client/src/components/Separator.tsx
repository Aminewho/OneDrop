import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, Music, Zap, Volume2, HardHat, Disc3, Aperture, ArrowLeft, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

// --- TYPES ---
interface StudioData {
  videoId: string;
  trackTitle: string;
  stemNames: string[]; // Ex: ['vocals', 'drums', 'bass', 'other']
}

// Interface pour le contrôle d'un stem
interface StemControl {
  name: string;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  audioUrl: string; // URL du fichier audio (à simuler ici)
  audioElement: HTMLAudioElement | null; // Référence à l'élément audio
}

const API_BASE_URL = "http://localhost:8080";

// --- HELPERS (Simulations Audio) ---

/**
 * Simule la récupération de l'URL du stem.
 * Dans une application réelle, ceci appellerait l'API backend pour obtenir l'URL S3/Google Cloud.
 * Le chemin serait typiquement: /api/audio/stems/{videoId}/{stemName}.mp3
 * @param videoId L'ID de la vidéo
 * @param stemName Le nom de la piste (vocals, drums, etc.)
 * @returns Une URL simulée.
 */
const getSimulatedStemUrl = (videoId: string, stemName: string): string => {
  // Remplacer par l'endpoint réel si vous l'avez configuré pour servir les fichiers.
  // Exemple d'un endpoint réel:
  // return `${API_BASE_URL}/api/audio/stems/${videoId}/${stemName}.mp3`;
  
  // Pour la démo, on utilise un placeholder, car la lecture réelle nécessiterait un serveur d'assets.
  console.log(`Simulating URL for: ${stemName} (Video: ${videoId})`);
  return `https://placehold.co/400x100/A00/fff?text=Stem+Audio+${stemName}`; 
};

// --- COMPONENT PRINCIPAL ---

export default function Separator() {
  const [, setLocation] = useLocation();
  const [studioData, setStudioData] = useState<StudioData | null>(null);
  const [stems, setStems] = useState<StemControl[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAllPlaying, setIsAllPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);


  // 1. Chargement des données et Initialisation des Stems
  useEffect(() => {
    const dataString = localStorage.getItem('currentStudioData');
    if (!dataString) {
      toast.error("Aucune donnée de studio trouvée. Redirection vers la bibliothèque.");
      setLocation('/library');
      return;
    }

    try {
      const data: StudioData = JSON.parse(dataString);
      setStudioData(data);

      const initialStems: StemControl[] = data.stemNames.map(name => {
        const audioUrl = getSimulatedStemUrl(data.videoId, name);
        const audioElement = new Audio(audioUrl);
        audioElement.loop = true; // Pour simuler une boucle audio
        
        // Configuration initiale des contrôles
        return {
          name,
          volume: 0.8, // Volume par défaut
          isMuted: false,
          isPlaying: false,
          audioUrl,
          audioElement,
        };
      });

      setStems(initialStems);
      setIsInitializing(false);

    } catch (e) {
      console.error("Erreur de parsing des données du studio:", e);
      toast.error("Erreur de chargement des données. Redirection.");
      setLocation('/library');
    }

    // Nettoyage lors du démontage (très important pour les éléments Audio)
    return () => {
      stems.forEach(stem => {
        if (stem.audioElement) {
          stem.audioElement.pause();
          stem.audioElement.src = ""; // Libérer la ressource
          // Pas besoin de removeEventListener ici car on recrée l'objet Audio.
        }
      });
    };
  }, []); // Exécuté une seule fois au montage

  // 2. Gestion des interactions audio
  const updateStemState = (name: string, updates: Partial<StemControl>) => {
    setStems(prevStems => {
      const newStems = prevStems.map(stem => {
        if (stem.name === name) {
          const newStem = { ...stem, ...updates };
          
          // Appliquer les changements à l'élément audio réel
          if (newStem.audioElement) {
            if ('volume' in updates && updates.volume !== undefined) {
              newStem.audioElement.volume = newStem.volume;
            }
            if ('isMuted' in updates && updates.isMuted !== undefined) {
              newStem.audioElement.muted = newStem.isMuted;
            }
            if ('isPlaying' in updates && updates.isPlaying !== undefined) {
              if (newStem.isPlaying) {
                // Pour la simulation, on ne peut pas vraiment jouer car l'URL est un placeholder.
                // Dans la vraie vie: newStem.audioElement.play().catch(e => console.error("Play failed", e));
                console.log(`Playing simulated stem: ${newStem.name}`);
              } else {
                newStem.audioElement.pause();
              }
            }
          }
          
          return newStem;
        }
        return stem;
      });

      // Mettre à jour l'état de lecture générale
      setIsAllPlaying(newStems.some(s => s.isPlaying));
      return newStems;
    });
  };

  const toggleAllPlayback = () => {
    const shouldPlay = !isAllPlaying;
    setStems(prevStems => prevStems.map(stem => {
      if (stem.audioElement) {
        if (shouldPlay) {
          // Dans la vraie vie, il faudrait gérer l'asynchronisme de play()
          // stem.audioElement.play().catch(e => console.error("Play failed", e)); 
          console.log(`Playing simulated stem: ${stem.name}`);
        } else {
          stem.audioElement.pause();
        }
      }
      return { ...stem, isPlaying: shouldPlay };
    }));
    setIsAllPlaying(shouldPlay);
    toast.success(shouldPlay ? "Playback démarré (simulé)" : "Playback en pause");
  };

  const toggleMute = (name: string) => {
    setStems(prevStems => {
      const newStems = prevStems.map(stem => {
        if (stem.name === name) {
          const newMuteState = !stem.isMuted;
          if (stem.audioElement) {
            stem.audioElement.muted = newMuteState;
          }
          return { ...stem, isMuted: newMuteState };
        }
        return stem;
      });
      return newStems;
    });
  };

  const handleVolumeChange = (name: string, newVolume: number) => {
    updateStemState(name, { volume: newVolume });
  };
  
  // Icônes dynamiques pour les stems
  const getStemIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'vocals':
        return <Music className="w-5 h-5 text-red-500" />;
      case 'drums':
        return <Disc3 className="w-5 h-5 text-blue-500" />;
      case 'bass':
        return <Aperture className="w-5 h-5 text-green-500" />;
      case 'other':
      default:
        return <Zap className="w-5 h-5 text-yellow-500" />;
    }
  }

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du Studio...</p>
      </div>
    );
  }

  if (!studioData) {
    // Devrait être géré par useEffect, mais en fallback
    return <div className="p-6 text-center text-red-500">Erreur critique : Données de studio manquantes.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
            <Button variant="ghost" onClick={() => setLocation('/library')} className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Library
            </Button>
            <h1 className="text-2xl font-bold truncate max-w-[70%] text-center" title={studioData.trackTitle}>
                {studioData.trackTitle}
            </h1>
            <Button onClick={toggleAllPlayback} className="px-6">
                {isAllPlaying ? (
                    <>
                        <Volume2 className="w-5 h-5 mr-2" /> Pause All
                    </>
                ) : (
                    <>
                        <Play className="w-5 h-5 mr-2 fill-white" /> Play All
                    </>
                )}
            </Button>
        </div>

        <div className="space-y-6">
          {stems.map((stem) => (
            <Card key={stem.name} className={`p-4 transition-shadow ${stem.isPlaying && 'shadow-lg ring-2 ring-primary/50'}`}>
              <div className="flex items-center gap-4">
                
                {getStemIcon(stem.name)}

                <h3 className="flex-1 font-semibold text-lg capitalize">{stem.name}</h3>
                
                {/* Bouton Mute/Unmute */}
                <Button 
                  size="icon" 
                  variant={stem.isMuted ? "default" : "outline"}
                  onClick={() => toggleMute(stem.name)}
                  className={`transition-colors ${stem.isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'text-foreground hover:bg-accent'}`}
                >
                  <Volume2 className={`w-4 h-4 ${stem.isMuted ? 'stroke-current' : 'text-muted-foreground'}`} />
                </Button>

                {/* Contrôle de Volume */}
                <div className="w-full max-w-xs flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-8 text-right">
                    {Math.round(stem.volume * 100)}%
                  </span>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={stem.volume}
                    onChange={(e) => handleVolumeChange(stem.name, parseFloat(e.target.value))}
                    className={`h-2 appearance-none rounded-full bg-gray-300 dark:bg-gray-700 transition-colors flex-1 ${stem.isMuted ? 'opacity-50' : ''}`}
                    style={{ 
                        background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${stem.volume * 100}%, var(--color-muted-foreground) ${stem.volume * 100}%, var(--color-muted-foreground) 100%)` 
                    }}
                  />
                </div>

                {/* Bouton Play/Pause individuel */}
                <Button
                  size="icon"
                  variant={stem.isPlaying ? "secondary" : "default"}
                  onClick={() => updateStemState(stem.name, { isPlaying: !stem.isPlaying })}
                  className="w-10 h-10"
                >
                  {stem.isPlaying ? (
                    <Volume2 className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
        
        {/* Placeholder pour la Waveform ou le Contrôle Global */}
        <Card className="mt-8 p-6 text-center bg-card/70 border-dashed border-2 border-primary/50">
            <h3 className="text-xl font-semibold mb-2">Global Mix Controls</h3>
            <p className="text-muted-foreground">Espace pour l'affichage de la waveform ou les contrôles d'exportation. (Video ID: {studioData.videoId})</p>
            <Button variant="outline" className="mt-4">
                Export Mix
            </Button>
        </Card>

      </div>
    </div>
  );
}