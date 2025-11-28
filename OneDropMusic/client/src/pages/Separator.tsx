import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, Music, Zap, Volume2, HardHat, Disc3, Aperture, ArrowLeft, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

// --- TYPES ---
interface StudioData {
  videoId: string;
  trackTitle: string;
  stemNames: string[];
}

// État du contrôle d'un stem, incluant les nœuds Web Audio
interface StemControl {
  name: string;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  audioUrl: string; 
  // Nœuds Web Audio pour le contrôle
  buffer: AudioBuffer | null; // Tampon audio décodé (la donnée source)
  gainNode: GainNode | null; // Contrôle du volume/mute
  sourceNode: AudioBufferSourceNode | null; // Nœud de lecture actuel
  hasLoadError: boolean;
}

const API_BASE_URL = "http://localhost:8080";

// --- HELPERS (Audio URL Retrieval) ---
const getStemAudioUrl = (videoId: string, stemName: string): string => {
  // Format d'endpoint correct avec paramètres de requête
  return `${API_BASE_URL}/api/audio/serve/track?videoId=${videoId}&trackName=${stemName}`;
};

// --- COMPONENT PRINCIPAL ---

export default function Separator() {
  const [, setLocation] = useLocation();
  const [studioData, setStudioData] = useState<StudioData | null>(null);
  const [stems, setStems] = useState<StemControl[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAudioReady, setIsAudioReady] = useState(false); // Vrai quand tous les buffers sont chargés
  const [isAllPlaying, setIsAllPlaying] = useState(false);

  // Utilisation de useRef pour maintenir l'instance AudioContext à travers les rendus
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackStartTimeRef = useRef<number | null>(null);

  // Fonction utilitaire pour décoder l'audio
  const loadAndDecodeAudio = async (url: string, context: AudioContext): Promise<AudioBuffer> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer);
  };

  // 1. Initialisation de l'AudioContext et Chargement des buffers
  useEffect(() => {
    const dataString = localStorage.getItem('currentStudioData');
    if (!dataString) {
      toast.error("Aucune donnée de studio trouvée. Redirection vers la bibliothèque.");
      // FIX: Encapsuler setLocation dans un try-catch pour gérer la SecurityError dans l'iframe
      try {
          setLocation('/library');
      } catch (e) {
          console.error("Failed to navigate using setLocation:", e);
      }
      return;
    }

    const data: StudioData = JSON.parse(dataString);
    setStudioData(data);
    
    // Initialiser l'AudioContext une seule fois
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const context = audioContextRef.current;

    const initialStems: StemControl[] = data.stemNames.map(name => ({
        name,
        volume: 0.8, 
        isMuted: false,
        isPlaying: false,
        audioUrl: getStemAudioUrl(data.videoId, name),
        buffer: null,
        gainNode: null,
        sourceNode: null,
        hasLoadError: false,
    }));
    setStems(initialStems);
    
    // Fonction de chargement de toutes les pistes
    const loadAllStems = async () => {
        const newStems = [...initialStems];
        let hasError = false;

        for (let i = 0; i < newStems.length; i++) {
            const stem = newStems[i];
            try {
                // 1. Charger et décoder le buffer audio
                const buffer = await loadAndDecodeAudio(stem.audioUrl, context);
                
                // 2. Créer et connecter le GainNode (Volume/Mute)
                const gainNode = context.createGain();
                gainNode.gain.value = stem.volume;
                gainNode.connect(context.destination);
                
                // Mettre à jour l'objet stem
                newStems[i] = {
                    ...stem,
                    buffer,
                    gainNode,
                };

            } catch (e) {
                console.error(`Error loading/decoding audio for stem ${stem.name}:`, e);
                toast.error(`Erreur critique : Impossible de charger la piste ${stem.name}. Le serveur a-t-il les fichiers ?`);
                newStems[i] = { ...stem, hasLoadError: true };
                hasError = true;
            }
        }

        setStems(newStems);
        setIsInitializing(false);
        if (!hasError) {
            setIsAudioReady(true);
            toast.success("Toutes les pistes sont chargées et synchronisées. Prêt à jouer !");
        } else {
            // Si une erreur est présente, l'état audio n'est pas prêt
            setIsAudioReady(false);
        }
    };

    loadAllStems();

    // Nettoyage: Arrêter la lecture et fermer l'AudioContext
    return () => {
        if (context.state !== 'closed') {
            context.close();
        }
    };
  }, []); 

  // Fonction pour créer un nouveau SourceNode et démarrer la lecture
  const createAndStartSource = (stem: StemControl, context: AudioContext, offset = 0): AudioBufferSourceNode => {
    if (!stem.buffer || !stem.gainNode) throw new Error("Audio nodes not ready.");
    
    // 1. Créer le nœud source
    const source = context.createBufferSource();
    source.buffer = stem.buffer;
    source.loop = true; // Pour une lecture en boucle
    
    // 2. Connecter Source -> Gain -> Destination
    source.connect(stem.gainNode);
    
    // 3. Définir le temps de début de lecture (très important pour la synchro)
    // Nous planifions la lecture 0.1s dans le futur pour donner le temps à tous les nœuds de se préparer
    const startTime = context.currentTime + 0.1;
    source.start(startTime, offset); // Démarrer à l'heure planifiée, à l'offset actuel
    
    return source;
  };

  // 2. Gestion de la Lecture/Pause et de la Synchro
  const toggleAllPlayback = () => {
    if (!isAudioReady || !audioContextRef.current) return;
    const context = audioContextRef.current;
    
    // Si l'AudioContext est suspendu (souvent à cause de l'autoplay), le reprendre
    if (context.state === 'suspended') {
        context.resume().catch(e => {
            console.error("Failed to resume AudioContext:", e);
            toast.error("Veuillez interagir une fois avec la page (clic) pour activer l'audio.");
            return;
        });
    }

    const shouldPlay = !isAllPlaying;

    setStems(prevStems => prevStems.map(stem => {
        // Ignorer les stems avec erreur de chargement
        if (stem.hasLoadError) return stem; 

        if (shouldPlay) {
            // DÉMARRER LA LECTURE
            let offset = 0;
            // Si le stem jouait déjà (cas de la pause/reprise individuelle non implémenté ici), il faudrait calculer l'offset.
            
            try {
                // S'assurer que l'ancien sourceNode est arrêté avant de créer un nouveau, 
                // bien que sourceNode = null sur pause devrait empêcher ça.
                if (stem.sourceNode) {
                    stem.sourceNode.stop();
                }
                
                const newSourceNode = createAndStartSource(stem, context, offset);
                
                // Sauvegarder l'heure de début globale pour le calcul de la position
                if (!playbackStartTimeRef.current) {
                    playbackStartTimeRef.current = context.currentTime + 0.1;
                }
                
                return { ...stem, isPlaying: true, sourceNode: newSourceNode };
            } catch (e) {
                console.error(`Failed to start stem ${stem.name}:`, e);
                return { ...stem, isPlaying: false };
            }

        } else {
            // ARRÊTER LA LECTURE
            if (stem.sourceNode) {
                // Arrêter la lecture immédiatement
                stem.sourceNode.stop();
                // L'heure de début est effacée si on arrête tout
                playbackStartTimeRef.current = null;
            }
            return { ...stem, isPlaying: false, sourceNode: null };
        }
    }));

    setIsAllPlaying(shouldPlay);
  };
  
  // 3. Gestion du Volume et du Mute (via GainNode)
  const handleVolumeChange = (name: string, newVolume: number) => {
    setStems(prevStems => prevStems.map(stem => {
        if (stem.name === name) {
            const finalVolume = stem.isMuted ? 0 : newVolume;
            if (stem.gainNode) {
                stem.gainNode.gain.value = finalVolume;
            }
            return { ...stem, volume: newVolume }; // Mettre à jour la valeur du fader
        }
        return stem;
    }));
  };

  const toggleMute = (name: string) => {
    setStems(prevStems => prevStems.map(stem => {
        if (stem.name === name) {
            const newMuteState = !stem.isMuted;
            if (stem.gainNode) {
                // Si muted: volume à 0. Sinon: volume à la valeur du fader.
                stem.gainNode.gain.value = newMuteState ? 0 : stem.volume;
            }
            return { ...stem, isMuted: newMuteState };
        }
        return stem;
    }));
  };
  
  // NOTE: La logique de lecture individuelle est complexe car elle doit 
  // être synchronisée avec les autres pistes. Pour ce cas d'utilisation (Mixer),
  // il est recommandé de seulement gérer le 'Play All'. Pour une lecture individuelle,
  // la piste devrait démarrer à l'offset actuel de l'AudioContext.
  const toggleIndividualPlayback = (name: string) => {
      // Simplement mute/unmute si la lecture globale est en cours
      if (isAllPlaying) {
          toggleMute(name);
          return;
      }
      
      // Logique Play/Pause individuelle (non synchronisée avec les autres si arrêtés)
      // Ceci est un scénario avancé que nous laissons désactivé pour forcer la synchro de groupe.
      toast.error("Veuillez utiliser le bouton 'Play All' pour garantir la synchronisation parfaite.");
  };


  // Icônes dynamiques pour les stems
  const getStemIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'vocals':
        return <Music className="w-5 h-5 text-red-500" />;
      case 'drums':
      case 'drum': // Spleeter peut sortir 'drum'
        return <Disc3 className="w-5 h-5 text-blue-500" />;
      case 'bass':
        return <Aperture className="w-5 h-5 text-green-500" />;
      case 'other':
      default:
        return <Zap className="w-5 h-5 text-yellow-500" />;
    }
  }

  // Affiche l'état de chargement
  if (isInitializing || !isAudioReady) {
    const loadedCount = stems.filter(s => s.buffer).length;
    const totalCount = stems.length;
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">
            {isInitializing ? "Initialisation du studio..." : 
             `Chargement et décodage des pistes... (${loadedCount}/${totalCount})`}
        </p>
        {stems.some(s => s.hasLoadError) && (
             <p className="mt-2 text-sm text-red-500">
                Certaines pistes ont échoué au chargement. Vérifiez les logs du serveur.
            </p>
        )}
      </div>
    );
  }

  if (!studioData) {
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
            <Button 
                onClick={toggleAllPlayback} 
                className="px-6"
                disabled={!isAudioReady || stems.some(s => s.hasLoadError)}
            >
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
            <Card key={stem.name} className={`p-4 transition-shadow ${stem.isPlaying && !stem.hasLoadError && 'shadow-lg ring-2 ring-primary/50'}`}>
              <div className="flex items-center gap-4">
                
                {getStemIcon(stem.name)}

                <h3 className="flex-1 font-semibold text-lg capitalize">{stem.name}</h3>
                
                {/* Indicateur d'erreur de chargement */}
                {stem.hasLoadError && (
                    <span className="px-3 py-1 text-xs font-bold text-red-700 bg-red-100 rounded-full">
                        LOAD ERROR
                    </span>
                )}
                
                {/* Bouton Mute/Unmute */}
                <Button 
                  size="icon" 
                  variant={stem.isMuted ? "default" : "outline"}
                  onClick={() => toggleMute(stem.name)}
                  disabled={stem.hasLoadError || !isAudioReady}
                  className={`transition-colors ${stem.isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'text-foreground hover:bg-accent'} ${stem.hasLoadError ? 'opacity-50' : ''}`}
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
                    disabled={stem.hasLoadError || !isAudioReady}
                    className={`h-2 appearance-none rounded-full bg-gray-300 dark:bg-gray-700 transition-colors flex-1 ${stem.isMuted || stem.hasLoadError ? 'opacity-50' : ''}`}
                    style={{ 
                        '--color-primary': 'hsl(var(--primary))',
                        '--color-muted-foreground': 'hsl(var(--muted-foreground))',
                        background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${stem.volume * 100}%, var(--color-muted-foreground) ${stem.volume * 100}%, var(--color-muted-foreground) 100%)` 
                    } as React.CSSProperties}
                  />
                </div>

                {/* Bouton Play/Pause individuel */}
                <Button
                  size="icon"
                  variant={stem.isPlaying ? "secondary" : "default"}
                  onClick={() => toggleIndividualPlayback(stem.name)}
                  disabled={stem.hasLoadError || !isAudioReady}
                  className={`w-10 h-10 ${stem.hasLoadError || !isAudioReady ? 'opacity-50' : ''}`}
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
        
        {/* Contrôle Global */}
        <Card className="mt-8 p-6 text-center bg-card/70 border-dashed border-2 border-primary/50">
            <h3 className="text-xl font-semibold mb-2">Global Mix Controls</h3>
            <p className="text-muted-foreground">L'API Web Audio est maintenant utilisée pour assurer une lecture parfaitement synchronisée.</p>
            <Button variant="outline" className="mt-4" disabled={stems.some(s => s.hasLoadError) || !isAudioReady}>
                Export Mix
            </Button>
        </Card>

      </div>
    </div>
  );
}