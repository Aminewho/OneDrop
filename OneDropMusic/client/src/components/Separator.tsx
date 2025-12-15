import { useState, useEffect, useRef, ReactNode } from "react";
// L'import 'useLocation' de 'wouter' est nécessaire pour la navigation
import { useLocation } from "wouter"; 
import { Loader2, Music, Zap, Volume2, HardHat, Disc3, Aperture, ArrowLeft, Play, Pause, X } from "lucide-react";

// Configuration Tailwind CSS de base (simulée pour le rendu immersif)
// Note: Dans un environnement React réel, Tailwind serait configuré globalement.
// Ici, les couleurs et classes sont utilisées directement.

// --- COMPOSANTS DE PLACEHOLDER ---
// Composant Card simplifié
interface CardProps {
    children?: ReactNode;
    className?: string;
}
const Card = ({ children, className }: CardProps) => <div className={`rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg ${className}`}>{children}</div>;

// Composant Button simplifié (simule le style shadcn/ui avec Tailwind)
interface ButtonProps {
    children?: ReactNode;
    onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    variant?: 'default' | 'outline' | 'secondary' | string;
    disabled?: boolean;
    size?: 'default' | 'icon' | string;
}
const Button = ({ children, onClick, className, variant = "default", disabled = false, size = "default" }: ButtonProps) => {
    
    // Définitions de style basiques pour simuler les variants
    let baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
    let sizeStyles = size === 'icon' ? 'h-10 w-10 p-2' : 'h-10 px-4 py-2';
    
    let variantStyles;
    switch (variant) {
        case 'outline':
            variantStyles = 'bg-white text-gray-900 border border-gray-300 shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700';
            break;
        case 'secondary':
            variantStyles = 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600';
            break;
        case 'default':
        default:
            variantStyles = 'bg-blue-600 text-white shadow-md hover:bg-blue-700';
            break;
    }
    
    if (disabled) {
        variantStyles += ' opacity-50 cursor-not-allowed';
    }

    return (
        <button
            onClick={onClick}
            className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
            disabled={disabled}
        >
            {children}
        </button>
    );
};

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
    sourceNode: AudioBufferSourceNode | null; // Nœud de lecture actuel (change à chaque play/resume)
    hasLoadError: boolean;
}

// NOTE: L'URL de l'API est conservée comme constante.
const API_BASE_URL = "http://127.0.0.1:8080";

// --- HELPERS (Audio URL Retrieval) ---
const getStemAudioUrl = (videoId: string, stemName: string): string => {
    // Format d'endpoint correct avec paramètres de requête
    return `${API_BASE_URL}/api/audio/serve/track?videoId=${videoId}&trackName=${stemName}`;
};

// Helper pour formater le temps en MM:SS
const formatTime = (seconds: number): string => {
    // S'assurer que les secondes ne sont pas négatives
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);
    return `${minutes}:${remainingSeconds.toFixed(0).padStart(2, '0')}`;
};

// --- COMPONENT PRINCIPAL ---

// Renommé en App pour être l'export par défaut standard des fichiers React autonomes
export default function App() { 
    const [, setLocation] = useLocation();
    const [studioData, setStudioData] = useState<StudioData | null>(null);
    const [stems, setStems] = useState<StemControl[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isAudioReady, setIsAudioReady] = useState(false); // Vrai quand tous les buffers sont chargés
    const [isAllPlaying, setIsAllPlaying] = useState(false);

    // États du lecteur
    const [maxDuration, setMaxDuration] = useState(0); // Durée totale de la piste (un loop)
    const [playbackTime, setPlaybackTime] = useState(0); // Position de lecture actuelle (pour l'affichage)

    // Utilisation de useRef pour maintenir l'instance AudioContext à travers les rendus
    const audioContextRef = useRef<AudioContext | null>(null);
    // Temps de contexte (AudioContext.currentTime) auquel la lecture a été planifiée pour démarrer.
    const playbackStartTimeRef = useRef<number | null>(null);
    // Position dans le buffer audio (en secondes) à partir de laquelle reprendre la lecture.
    const playbackPositionRef = useRef(0); 

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
        // Logique de récupération des données de studio depuis localStorage (simulé)
        const dataString = typeof localStorage !== 'undefined' ? localStorage.getItem('currentStudioData') : null;
        
        if (!dataString) {
            // Dans un environnement de rendu côté serveur ou d'iframe, localStorage peut causer des erreurs
            try {
                // Tenter la navigation (si wouter est supporté)
                if (typeof setLocation === 'function') {
                    setLocation('/library');
                }
            } catch (e) {
                console.error("Failed to navigate or access localStorage:", e);
            }
            setIsInitializing(false);
            return;
        }

        const data: StudioData = JSON.parse(dataString);
        setStudioData(data);
        
        // Initialiser l'AudioContext une seule fois
        if (!audioContextRef.current) {
            // @ts-ignore pour la compatibilité navigateur
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            // Tenter de reprendre le contexte pour les navigateurs qui le suspendent
            if (audioContextRef.current.state === 'suspended') {
              // Note: La reprise doit être déclenchée par une interaction utilisateur réelle
              // Mais on la prépare ici.
              audioContextRef.current.resume().catch(e => console.log("AudioContext resume failed on init:", e));
            }
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
            let allLoadPromises = [];

            for (let i = 0; i < newStems.length; i++) {
                const stem = newStems[i];
                
                // Créer le GainNode immédiatement
                const gainNode = context.createGain();
                gainNode.gain.value = stem.volume;
                gainNode.connect(context.destination);

                newStems[i].gainNode = gainNode;

                // Enregistrer la promesse de chargement
                allLoadPromises.push(
                    loadAndDecodeAudio(stem.audioUrl, context)
                    .then(buffer => {
                        newStems[i].buffer = buffer;
                    })
                    .catch(e => {
                        console.error(`Error loading/decoding audio for stem ${stem.name}:`, e);
                        newStems[i].hasLoadError = true;
                        hasError = true;
                    })
                );
            }

            // Attendre que toutes les pistes soient chargées
            Promise.all(allLoadPromises).finally(() => {
                const updatedStems = [...newStems];
                setStems(updatedStems);
                setIsInitializing(false);
                if (!hasError) {
                    setIsAudioReady(true);
                    // Définir la durée maximale (utiliser le premier buffer trouvé)
                    if (updatedStems.some(s => s.buffer)) {
                        setMaxDuration(updatedStems.find(s => s.buffer)?.buffer?.duration || 0);
                    }
                } else {
                    setIsAudioReady(false);
                }
            });
        };

        loadAllStems();

        // Nettoyage: Arrêter la lecture et fermer l'AudioContext 
        return () => {
            // Arrêter tous les SourceNodes
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try {
                        // Arrêter immédiatement
                        stem.sourceNode.stop(0); 
                    } catch (e) {
                        // Ignorer les erreurs si le noeud est déjà arrêté
                    }
                }
                return { ...stem, sourceNode: null, isPlaying: false };
            }));

            // Tenter de fermer le context (optionnel mais propre)
            if (context && context.state !== 'closed') {
                context.close().catch(e => console.error("Error closing AudioContext:", e));
            }
        };
    }, [setLocation]); 

    // 2. Logique de suivi du temps (requestAnimationFrame)
    useEffect(() => {
        let animationFrameId: number | null = null;

        const context = audioContextRef.current;
        
        const updateTime = () => {
            if (context && playbackStartTimeRef.current !== null) {
                const timeElapsedSinceStart = context.currentTime - playbackStartTimeRef.current;
                
                // Calculer le temps total écoulé (y compris la boucle)
                let currentTotalTime = playbackPositionRef.current + timeElapsedSinceStart;
                
                // Appliquer le modulo pour la boucle
                if (maxDuration > 0) {
                    currentTotalTime %= maxDuration;
                }
                
                setPlaybackTime(currentTotalTime);
            }
            animationFrameId = requestAnimationFrame(updateTime);
        };
        
        if (isAllPlaying) {
            // S'assurer que le context est bien démarré si on commence à jouer
            if (context && context.state !== 'running') {
                 context.resume().catch(e => console.log("AudioContext resume failed during time update:", e));
            }
            animationFrameId = requestAnimationFrame(updateTime);
        } else {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }

        return () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isAllPlaying, maxDuration]);


    // Fonction pour créer un nouveau SourceNode et démarrer la lecture
    const createAndStartSource = (stem: StemControl, context: AudioContext, offset = 0): AudioBufferSourceNode => {
        if (!stem.buffer || !stem.gainNode) throw new Error("Audio nodes not ready.");
        
        // 1. Créer le nœud source (un SourceNode est à usage unique)
        const source = context.createBufferSource();
        source.buffer = stem.buffer;
        source.loop = true; // Pour une lecture en boucle
        
        // 2. Connecter Source -> Gain -> Destination
        source.connect(stem.gainNode);
        
        // 3. Définir le temps de début de lecture (pour la synchro)
        // Planifier le démarrage légèrement dans le futur (0.05s est plus sûr que 0.1s)
        const scheduledTime = context.currentTime + 0.05; 
        
        // Utiliser start(scheduledTime, offset)
        source.start(scheduledTime, offset % stem.buffer.duration); 
        
        return source;
    };

    // 3. Gestion de la Lecture/Pause et de la Synchro
    const toggleAllPlayback = () => {
        if (!isAudioReady || !audioContextRef.current) return;
        const context = audioContextRef.current;
        
        const shouldPlay = !isAllPlaying;

        if (shouldPlay) {
            // --- DÉMARRER / REPRENDRE ---
            
            // 1. Reprendre le context s'il est suspendu
            if (context.state !== 'running') {
                context.resume().catch(e => {
                    console.error("Failed to resume AudioContext:", e);
                    return;
                });
            }

            // 2. Déterminer l'offset et l'heure de début
            const offset = playbackPositionRef.current; 
            const scheduledTime = context.currentTime + 0.05; // Temps de synchro
            playbackStartTimeRef.current = context.currentTime; // Le temps réel de début du contexte

            setStems(prevStems => prevStems.map(stem => {
                // Ignorer les stems avec erreur de chargement
                if (stem.hasLoadError || !stem.buffer || !stem.gainNode) return stem; 

                try {
                    // Arrêter l'ancien sourceNode s'il existe
                    if (stem.sourceNode) {
                        stem.sourceNode.stop(0);
                    }
                    
                    // Créer et démarrer le nouveau nœud source avec l'offset
                    const newSourceNode = createAndStartSource(stem, context, offset);
                    
                    return { ...stem, isPlaying: true, sourceNode: newSourceNode };
                } catch (e) {
                    console.error(`Failed to start stem ${stem.name}:`, e);
                    return { ...stem, isPlaying: false };
                }
            }));

        } else {
            // --- PAUSE ---

            // 1. Calculer la position actuelle avant l'arrêt
            if (playbackStartTimeRef.current !== null && context) {
                // Temps écoulé depuis le début de la lecture planifiée
                const timeElapsedSinceStart = context.currentTime - playbackStartTimeRef.current;
                
                let newPosition = playbackPositionRef.current + timeElapsedSinceStart;
                
                if (maxDuration > 0) {
                    // Nouvelle position = (Position précédente + Temps écoulé) % Durée du buffer
                    newPosition %= maxDuration;
                }
                playbackPositionRef.current = newPosition;
            }
            
            // Mettre à jour l'état d'affichage au moment exact de la pause
            setPlaybackTime(playbackPositionRef.current);

            // 2. Arrêter tous les SourceNodes
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    // Arrêter la lecture immédiatement
                    try {
                        stem.sourceNode.stop(0); 
                    } catch (e) {
                        console.warn("SourceNode already stopped:", e);
                    }
                }
                return { ...stem, isPlaying: false, sourceNode: null };
            }));
            
            // 3. Clear timing ref et suspendre le context
            playbackStartTimeRef.current = null;
            context.suspend().catch(e => console.error("Failed to suspend AudioContext:", e));
        }
        
        // 4. Mettre à jour l'état de lecture global
        setIsAllPlaying(shouldPlay);
    };
    
    // 4. Gestion du Seek (déplacement dans la piste)
    const handleSeek = (newTime: number) => {
        if (!audioContextRef.current || !isAudioReady || maxDuration === 0) return;
        const context = audioContextRef.current;
        
        // S'assurer que le nouveau temps est dans les limites [0, maxDuration]
        const clampedTime = Math.max(0, Math.min(newTime, maxDuration));

        // 1. Mettre à jour les références et l'affichage
        playbackPositionRef.current = clampedTime;
        setPlaybackTime(clampedTime); 
        
        // 2. Si actuellement en lecture, on arrête et on redémarre tout
        if (isAllPlaying) {
            
            // Arrêter les sources actuelles
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try {
                        stem.sourceNode.stop(0);
                    } catch (e) { /* ignore */ }
                }
                return { ...stem, sourceNode: null };
            }));

            // Redémarrer la lecture à partir du nouvel offset
            playbackStartTimeRef.current = context.currentTime; 

            setStems(prevStems => prevStems.map(stem => {
                if (stem.hasLoadError || !stem.buffer || !stem.gainNode) return stem; 

                try {
                    const newSourceNode = createAndStartSource(stem, context, clampedTime);
                    return { ...stem, isPlaying: true, sourceNode: newSourceNode };
                } catch (e) {
                    console.error(`Failed to restart stem ${stem.name} after seek:`, e);
                    return { ...stem, isPlaying: false };
                }
            }));
        }
    };
    
    // 5. Gestion du Volume et du Mute (via GainNode)
    const handleVolumeChange = (name: string, newVolume: number) => {
        setStems(prevStems => prevStems.map(stem => {
            if (stem.name === name) {
                // Le volume réel appliqué est 0 si muté, sinon la nouvelle valeur
                const finalVolume = stem.isMuted ? 0 : newVolume;
                if (stem.gainNode && audioContextRef.current) {
                    // Utilisation d'AudioParam.setValueAtTime pour un changement immédiat
                    stem.gainNode.gain.setValueAtTime(finalVolume, audioContextRef.current.currentTime);
                }
                return { ...stem, volume: newVolume }; // Mettre à jour la valeur du fader dans l'état
            }
            return stem;
        }));
    };

    const toggleMute = (name: string) => {
        setStems(prevStems => prevStems.map(stem => {
            if (stem.name === name) {
                const newMuteState = !stem.isMuted;
                if (stem.gainNode && audioContextRef.current) {
                    // Si muted: volume à 0. Sinon: volume à la valeur du fader.
                    const finalVolume = newMuteState ? 0 : stem.volume;
                    // Changement immédiat
                    stem.gainNode.gain.setValueAtTime(finalVolume, audioContextRef.current.currentTime);
                }
                return { ...stem, isMuted: newMuteState };
            }
            return stem;
        }));
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 font-inter p-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p className="mt-4 text-gray-700 dark:text-gray-300">
                    {isInitializing ? "Initialisation du studio..." : 
                    `Chargement et décodage des pistes... (${loadedCount}/${totalCount})`}
                </p>
                {stems.some(s => s.hasLoadError) && (
                    <p className="mt-2 text-sm text-red-500 flex items-center">
                        <X className="w-4 h-4 mr-1"/>
                        Certaines pistes ont échoué au chargement.
                    </p>
                )}
            </div>
        );
    }

    if (!studioData) {
        return <div className="p-6 text-center text-red-500 dark:text-red-300">Erreur critique : Données de studio manquantes ou échec d'initialisation.</div>;
    }
    
    // Rendu du composant principal
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8 font-inter">
            <div className="max-w-4xl mx-auto">
                
                {/* En-tête et Bouton Retour */}
                <div className="flex items-center justify-between mb-8">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            // Tenter d'arrêter la lecture et de naviguer
                            if (isAllPlaying) toggleAllPlayback();
                            setLocation('/library');
                        }} 
                        className="text-muted-foreground border-gray-300 dark:border-gray-700"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour
                    </Button>
                    <h1 className="text-2xl font-bold truncate max-w-[70%] text-center text-gray-900 dark:text-white" title={studioData.trackTitle}>
                        {studioData.trackTitle}
                    </h1>
                    {/* Espace de remplissage pour l'alignement */}
                    <div className="w-24 h-10"></div> 
                </div>
                
                {/* --- BARRE DE LECTURE (PLAYER BAR) --- */}
                <Card className="mb-8 p-4 shadow-xl bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                        
                        {/* Bouton Play/Pause Global */}
                        <Button 
                            onClick={toggleAllPlayback} 
                            size="icon"
                            className={`h-14 w-14 rounded-full ${isAllPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'} text-white shadow-lg flex-shrink-0`}
                            disabled={!isAudioReady || stems.some(s => s.hasLoadError)}
                        >
                            {isAllPlaying ? (
                                <Pause className="w-7 h-7 fill-white" /> 
                            ) : (
                                <Play className="w-7 h-7 fill-white ml-1" /> 
                            )}
                        </Button>

                        <div className="flex-1 flex items-center gap-3 w-full min-w-[200px] sm:min-w-0">
                            
                            {/* Temps Actuel */}
                            <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-12 text-left flex-shrink-0">
                                {formatTime(playbackTime)}
                            </span>
                            
                            {/* Barre de Progression (Seek Bar) */}
                            <input 
                                type="range"
                                min="0"
                                max={maxDuration}
                                step="0.01"
                                // Utiliser playbackTime pour l'affichage et le glissement
                                value={playbackTime} 
                                onChange={(e) => {
                                    const newTime = parseFloat(e.target.value);
                                    // Mettre à jour l'état d'affichage en temps réel pendant le glissement
                                    setPlaybackTime(newTime);
                                }}
                                onMouseUp={(e) => {
                                    // Démarrer le seek quand le glissement est terminé (Desktop)
                                    const newTime = parseFloat((e.target as HTMLInputElement).value);
                                    handleSeek(newTime);
                                }}
                                onTouchEnd={(e) => {
                                    // Démarrer le seek quand le glissement est terminé (Mobile)
                                    const newTime = parseFloat((e.target as HTMLInputElement).value);
                                    handleSeek(newTime);
                                }}
                                disabled={!isAudioReady || stems.some(s => s.hasLoadError)}
                                className={`h-2 appearance-none rounded-full bg-gray-300 dark:bg-gray-700 transition-colors flex-1 cursor-pointer`}
                                style={{ 
                                    // Utilisation d'une variable CSS pour le remplissage de la barre
                                    '--progress-width': `${(playbackTime / maxDuration) * 100}%`,
                                    background: `linear-gradient(to right, #2563EB var(--progress-width), #ccc var(--progress-width), #ccc 100%)`,
                                    // Styles spécifiques pour le thumb (le petit cercle) du range input
                                    '--tw-ring-color': '#2563EB', // Blue-600
                                } as React.CSSProperties}
                            />

                            {/* Durée Totale */}
                            <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-12 text-right flex-shrink-0">
                                {formatTime(maxDuration)}
                            </span>
                        </div>
                    </div>
                </Card>
                {/* --- FIN BARRE DE LECTURE --- */}

                {/* --- CONTRÔLES DE PISTE (STEMS) --- */}
                <div className="space-y-4">
                    {stems.map((stem) => (
                        <Card 
                            key={stem.name} 
                            className={`p-4 transition-all duration-300 shadow-md ${
                                stem.isPlaying && !stem.isMuted ? 'ring-2 ring-offset-2 ring-blue-500/70 border-blue-500' : 'hover:shadow-lg'
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                
                                {getStemIcon(stem.name)}

                                <h3 className="flex-1 font-semibold text-lg capitalize truncate max-w-[200px] text-gray-900 dark:text-white">{stem.name}</h3>
                                
                                {/* Indicateur d'erreur de chargement */}
                                {stem.hasLoadError && (
                                    <span className="px-3 py-1 text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-full">
                                        ERREUR
                                    </span>
                                )}
                                
                                {/* Contrôle de Volume et Mute/Unmute */}
                                <div className="flex items-center gap-3 w-full sm:max-w-md">
                                    
                                    {/* Bouton Mute/Unmute */}
                                    <Button 
                                        size="icon" 
                                        variant={stem.isMuted ? "default" : "outline"}
                                        onClick={() => toggleMute(stem.name)}
                                        disabled={stem.hasLoadError || !isAudioReady}
                                        className={`transition-colors h-10 w-10 flex-shrink-0 ${
                                            stem.isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <Volume2 className={`w-5 h-5 ${stem.isMuted ? 'stroke-white fill-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                    </Button>

                                    {/* Fader de Volume */}
                                    <input 
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={stem.volume}
                                        onChange={(e) => handleVolumeChange(stem.name, parseFloat(e.target.value))}
                                        disabled={stem.hasLoadError || !isAudioReady}
                                        className={`h-2 appearance-none rounded-full bg-gray-300 dark:bg-gray-700 transition-colors flex-1 cursor-pointer 
                                            ${stem.isMuted || stem.hasLoadError ? 'opacity-50' : ''}`}
                                        style={{ 
                                            '--volume-level': `${stem.volume * 100}%`,
                                            background: `linear-gradient(to right, #4c51bf var(--volume-level), #ccc var(--volume-level), #ccc 100%)` 
                                        } as React.CSSProperties}
                                    />

                                    <span className="text-sm text-muted-foreground w-10 text-right text-gray-500 dark:text-gray-400 flex-shrink-0">
                                        {Math.round(stem.volume * 100)}%
                                    </span>
                                </div>

                            </div>
                        </Card>
                    ))}
                </div>
                
                {/* Informations de Référence */}
                <Card className="mt-8 p-6 text-center bg-gray-100 dark:bg-gray-700 border-dashed border-2 border-blue-500/50">
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Web Audio Studio</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-bold">Durée totale de la boucle:</span> {formatTime(maxDuration)} ({maxDuration.toFixed(2)}s).
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-bold">Position de reprise (Offset):</span> {playbackPositionRef.current.toFixed(2)}s.
                    </p>
                </Card>

            </div>
        </div>
    );
}