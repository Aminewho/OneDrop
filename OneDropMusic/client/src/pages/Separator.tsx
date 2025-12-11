import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { Loader2, Music, Zap, Volume2, HardHat, Disc3, Aperture, ArrowLeft, Play, Pause, X, ArrowRight, Repeat2 } from "lucide-react";

// --- Mock Components (using standard Tailwind styling) ---

interface CardProps {
    children?: ReactNode;
    className?: string;
}
const Card = ({ children, className }: CardProps) => (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg ${className}`}>
        {children}
    </div>
);

interface ButtonProps {
    children?: ReactNode;
    onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    variant?: 'default' | 'outline' | 'secondary' | 'danger' | string;
    disabled?: boolean;
    size?: 'default' | 'icon' | string;
}

const Button = ({ children, onClick, className, variant = "default", disabled = false, size = "default" }: ButtonProps) => {
    let baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500";
    let sizeStyles = size === 'icon' ? 'h-10 w-10 p-2' : 'h-10 px-4 py-2';
    
    // Default Tailwind color mapping
    let variantStyles = '';
    switch (variant) {
        case 'default':
            variantStyles = 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800';
            break;
        case 'outline':
            variantStyles = 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
            break;
        case 'secondary':
            variantStyles = 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600';
            break;
        case 'danger':
            variantStyles = 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800';
            break;
        default:
            variantStyles = 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800';
    }

    const finalStyles = `${baseStyles} ${sizeStyles} ${variantStyles} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

    return (
        <button
            onClick={onClick}
            className={finalStyles}
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
    buffer: AudioBuffer | null;
    gainNode: GainNode | null; 
    sourceNode: AudioBufferSourceNode | null;
    hasLoadError: boolean;
}

const API_BASE_URL = "http://localhost:8080";

// Helper pour formater le temps en MM:SS
const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toFixed(0).padStart(2, '0')}`;
};

// Helper pour obtenir l'URL audio
const getStemAudioUrl = (videoId: string, stemName: string): string => {
    return `${API_BASE_URL}/api/audio/serve/track?videoId=${videoId}&trackName=${stemName}`;
};


// --- COMPONENT PRINCIPAL ---

export default function Separator() {
    const [, setLocation] = useLocation();
    const [studioData, setStudioData] = useState<StudioData | null>(null);
    const [stems, setStems] = useState<StemControl[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isAudioReady, setIsAudioReady] = useState(false); 
    const [isAllPlaying, setIsAllPlaying] = useState(false);

    const [maxDuration, setMaxDuration] = useState(0); 
    const [playbackTime, setPlaybackTime] = useState(0); 

    const [loopStart, setLoopStart] = useState(0.01); 
    const [loopEnd, setLoopEnd] = useState(0);     
    const [isLooping, setIsLooping] = useState(false); 

    const audioContextRef = useRef<AudioContext | null>(null);
    const playbackStartTimeRef = useRef<number | null>(null);
    const playbackPositionRef = useRef(0); 
    
    const seekBarRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef<'start' | 'end' | null>(null);


    // Fonction utilitaire pour décoder l'audio
    const loadAndDecodeAudio = async (url: string, context: AudioContext): Promise<AudioBuffer> => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    };

    // Fonction pour créer un nouveau SourceNode et démarrer la lecture
    // isLoopingProp, loopStartProp, loopEndProp sont passés pour garantir l'utilisation des valeurs les plus récentes
    const createAndStartSource = useCallback((
        stem: StemControl, 
        context: AudioContext, 
        offset = 0, 
        isLoopingProp: boolean, 
        loopStartProp: number, 
        loopEndProp: number
    ): AudioBufferSourceNode => {
        if (!stem.buffer || !stem.gainNode) throw new Error("Audio nodes not ready.");
        
        const source = context.createBufferSource();
        source.buffer = stem.buffer;

        let actualOffset = offset;
        
        // Utiliser la propriété de boucle passée
        if (isLoopingProp && loopEndProp > loopStartProp) {
            source.loop = true; 
            source.loopStart = loopStartProp; 
            source.loopEnd = loopEndProp;     
            
            // Si l'offset est hors des bornes A-B, on le remet au début de la boucle
            if (actualOffset < loopStartProp || actualOffset >= loopEndProp) {
                actualOffset = loopStartProp; 
            }
        } else {
            // Boucle désactivée (ou bornes invalides)
            source.loop = false;
            
            // S'assurer que l'offset est modulo la durée totale si > 0
            if (stem.buffer.duration > 0) {
                 actualOffset %= stem.buffer.duration;
            } else {
                 actualOffset = 0;
            }
        }
        
        source.connect(stem.gainNode);
        
        const scheduledTime = context.currentTime + 0.05; 
        source.start(scheduledTime, actualOffset); 
        
        return source;
    }, []); 

    // 1. Initialisation de l'AudioContext et Chargement des buffers
    useEffect(() => {
        const dataString = localStorage.getItem('currentStudioData');
        if (!dataString) {
            try {
                setLocation('/library');
            } catch (e) {
                console.error("Failed to navigate using setLocation:", e);
            }
            return;
        }

        const data: StudioData = JSON.parse(dataString);
        setStudioData(data);
        
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(e => console.error("Error resuming AudioContext:", e));
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
        
        const loadAllStems = async () => {
            const newStems = [...initialStems];
            let hasError = false;
            let maxDurationFound = 0;

            const loadPromises = newStems.map(async (stem, i) => {
                const gainNode = context.createGain();
                gainNode.gain.value = stem.volume;
                gainNode.connect(context.destination);
                newStems[i].gainNode = gainNode;

                try {
                    const buffer = await loadAndDecodeAudio(stem.audioUrl, context);
                    newStems[i].buffer = buffer;
                    if (buffer.duration > maxDurationFound) {
                        maxDurationFound = buffer.duration;
                    }
                } catch (e) {
                    console.error(`Error loading/decoding audio for stem ${stem.name}:`, e);
                    newStems[i].hasLoadError = true;
                    hasError = true;
                }
            });

            await Promise.all(loadPromises);

            setStems(newStems);
            setIsInitializing(false);
            
            if (!hasError) {
                setIsAudioReady(true);
                setMaxDuration(maxDurationFound);
                // Initialise la fin de boucle à la durée maximale
                setLoopEnd(maxDurationFound); 
            } else {
                setIsAudioReady(false);
            }
        };

        loadAllStems();

        return () => {
            // Nettoyage des sourceNodes lors du démontage du composant
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try {
                        stem.sourceNode.stop(context.currentTime + 0.01); 
                    } catch (e) { /* ignore */ }
                }
                return { ...stem, sourceNode: null, isPlaying: false };
            }));

            if (context && context.state !== 'closed') {
                context.suspend().catch(e => console.error("Error suspending AudioContext:", e));
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
                
                let currentTotalTime = playbackPositionRef.current + timeElapsedSinceStart;
                
                // --- LOGIQUE DE BOUCLAGE VISUEL A-B ---
                if (isLooping && loopEnd > loopStart) {
                    if (currentTotalTime >= loopEnd) {
                        const loopLength = loopEnd - loopStart;
                        const overshoot = currentTotalTime - loopEnd;
                        currentTotalTime = loopStart + (overshoot % loopLength);
                    }
                    if (currentTotalTime < loopStart) {
                        currentTotalTime = loopStart;
                    }

                } else if (maxDuration > 0) {
                    // Boucle complète standard si A-B looping est désactivé
                    if (currentTotalTime >= maxDuration) {
                        currentTotalTime = currentTotalTime % maxDuration; 
                    }
                }
                // --- FIN LOGIQUE ---
                
                setPlaybackTime(currentTotalTime);
            }
            animationFrameId = requestAnimationFrame(updateTime);
        };
        
        if (isAllPlaying) {
            let animationFrameId = requestAnimationFrame(updateTime);
        } else {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }

        return () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAllPlaying, maxDuration, isLooping, loopStart, loopEnd]); 


    // 3. Gestion de la Lecture/Pause et de la Synchro
    const toggleAllPlayback = useCallback(() => {
        if (!isAudioReady || !audioContextRef.current) return;
        const context = audioContextRef.current;
        
        const shouldPlay = !isAllPlaying;

        if (shouldPlay) {
            // --- DÉMARRER / REPRENDRE ---
            
            if (context.state !== 'running') {
                context.resume().catch(e => {
                    console.error("Failed to resume AudioContext:", e);
                    return;
                });
            }

            let actualOffset = playbackPositionRef.current; 
            
            // Important: utiliser l'état de looping actuel pour le démarrage
            const currentLoopState = isLooping; 
            const currentLoopStart = loopStart;
            const currentLoopEnd = loopEnd;
            
            if (currentLoopState && currentLoopEnd > currentLoopStart) {
                if (actualOffset < currentLoopStart || actualOffset >= currentLoopEnd) {
                    actualOffset = currentLoopStart; 
                }
            } else if (maxDuration > 0) {
                actualOffset %= maxDuration;
            }

            const scheduledTime = context.currentTime + 0.05; 
            playbackStartTimeRef.current = scheduledTime; 

            setStems(prevStems => prevStems.map(stem => {
                if (stem.hasLoadError || !stem.buffer || !stem.gainNode) return stem; 

                try {
                    if (stem.sourceNode) {
                        try {
                            // Arrêter l'ancienne source si elle existe
                            stem.sourceNode.stop(0); 
                        } catch (e) { /* ignore */ }
                    }
                    
                    // Créer et démarrer la nouvelle source avec l'état actuel
                    const newSourceNode = createAndStartSource(
                        stem, context, actualOffset, 
                        currentLoopState, currentLoopStart, currentLoopEnd
                    );
                    
                    return { ...stem, isPlaying: true, sourceNode: newSourceNode };
                } catch (e) {
                    console.error(`Failed to start stem ${stem.name}:`, e);
                    return { ...stem, isPlaying: false };
                }
            }));

        } else {
            // --- PAUSE ---
            
            if (playbackStartTimeRef.current !== null && context) {
                const timeElapsedSinceStart = context.currentTime - playbackStartTimeRef.current;
                
                let newPosition = playbackPositionRef.current + timeElapsedSinceStart;
                
                // Appliquer la logique de bouclage A-B pour capturer la position précise
                if (isLooping && loopEnd > loopStart) {
                    if (newPosition >= loopEnd) {
                        const loopLength = loopEnd - loopStart;
                        const overshoot = newPosition - loopEnd;
                        newPosition = loopStart + (overshoot % loopLength);
                    }
                } else if (maxDuration > 0) {
                    newPosition %= maxDuration;
                }
                
                playbackPositionRef.current = newPosition;
            }
            
            setPlaybackTime(playbackPositionRef.current);

            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try {
                        stem.sourceNode.stop(0); // Arrêt immédiat
                    } catch (e) { /* ignore */ }
                }
                return { ...stem, isPlaying: false, sourceNode: null };
            }));
            
            playbackStartTimeRef.current = null;
            context.suspend().catch(e => console.error("Failed to suspend AudioContext:", e));
        }
        
        setIsAllPlaying(shouldPlay);
    }, [isAllPlaying, isAudioReady, maxDuration, createAndStartSource, isLooping, loopStart, loopEnd]);
    
    // 4. Gestion du Seek (déplacement dans la piste)
    const handleSeek = useCallback((newTime: number, forceLoopState?: boolean) => {
        if (!audioContextRef.current || !isAudioReady || maxDuration === 0) return;
        const context = audioContextRef.current;
        
        const currentLoopState = forceLoopState !== undefined ? forceLoopState : isLooping;

        // 1. S'assurer que le nouveau temps est dans les limites [0, maxDuration]
        let clampedTime = Math.max(0, Math.min(newTime, maxDuration));
        
        if (currentLoopState && loopEnd > loopStart) { 
            if (clampedTime < loopStart || clampedTime >= loopEnd) {
                clampedTime = loopStart; 
            }
        } else {
             if (maxDuration > 0) {
                clampedTime = clampedTime % maxDuration;
            }
        }

        // 2. Mettre à jour les références et l'affichage
        playbackPositionRef.current = clampedTime;
        setPlaybackTime(clampedTime); 
        
        // 3. Si actuellement en lecture, on arrête et on redémarre tout
        if (isAllPlaying) {
            
            // Arrêter les sources actuelles (si elles existent)
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try {
                        stem.sourceNode.stop(0); // Arrêt immédiat
                    } catch (e) { /* ignore */ }
                }
                return { ...stem, sourceNode: null };
            }));

            // Redémarrer la lecture à partir du nouvel offset
            const scheduledTime = context.currentTime + 0.05; 
            playbackStartTimeRef.current = scheduledTime; 

            setStems(prevStems => prevStems.map(stem => {
                if (stem.hasLoadError || !stem.buffer || !stem.gainNode) return stem; 

                try {
                    // Utiliser les valeurs d'état actuelles (ou forcées) pour les bornes A/B
                    const newSourceNode = createAndStartSource(stem, context, clampedTime, currentLoopState, loopStart, loopEnd);
                    return { ...stem, isPlaying: true, sourceNode: newSourceNode };
                } catch (e) {
                    console.error(`Failed to restart stem ${stem.name} after seek:`, e);
                    return { ...stem, isPlaying: false };
                }
            }));
        }
    }, [isAllPlaying, isAudioReady, maxDuration, createAndStartSource, isLooping, loopStart, loopEnd]);
    
    // 5. NOUVELLE LOGIQUE: Gère l'activation/désactivation de la boucle A-B
    const toggleLoop = useCallback(() => {
        if (!isAudioReady || maxDuration === 0) return;
        
        const nextLoopState = !isLooping;

        if (!nextLoopState) { 
            // --- ACTION: Tourner OFF la boucle (Implémentation de la demande utilisateur) ---
            
            const wasPlaying = isAllPlaying;
            
            // 1. Si la lecture est active, on PAUSE proprement pour capturer la position exacte.
            if (wasPlaying) {
                // Cette fonction met en pause, met à jour playbackPositionRef.current, et suspend le contexte.
                toggleAllPlayback(); 
            }
            
            // 2. Mettre à jour l'état de boucle et réinitialiser les marqueurs A/B aux limites
            setIsLooping(false); 
            setLoopStart(0.01); 
            setLoopEnd(maxDuration);
            
            // 3. Si l'audio était en lecture, on le relance immédiatement (reprise de lecture).
            if (wasPlaying) {
                 // Petite attente pour s'assurer que l'état React (isLooping=false) est appliqué 
                 // et que le contexte est suspendu, avant de le reprendre.
                setTimeout(() => {
                    toggleAllPlayback(); // Reprend la lecture (va utiliser isLooping=false)
                }, 50); 
            }
            
        } else {
            // --- ACTION: Tourner ON la boucle ---
            setIsLooping(true);
            
            // Si en lecture, on redémarre les sources avec les nouveaux paramètres de boucle.
            if (isAllPlaying) {
                // Utilise handleSeek pour s'assurer que les nouveaux nœuds audio sont créés
                handleSeek(playbackTime, true); 
            }
        }
    }, [isLooping, isAllPlaying, maxDuration, playbackTime, isAudioReady, toggleAllPlayback, handleSeek]);


    // Fonction: Retour 5 secondes
    const handleRewind = useCallback(() => {
        if (!isAudioReady || maxDuration === 0) return;

        let newTime = playbackTime - 5;
        if (newTime < 0) {
            newTime = 0; 
        }
        
        // handleSeek utilise l'état isLooping actuel
        handleSeek(newTime);
    }, [isAudioReady, playbackTime, maxDuration, handleSeek]);
    
    // Fonction: Avancer 5 secondes
    const handleForward = useCallback(() => {
        if (!isAudioReady || maxDuration === 0) return;

        let newTime = playbackTime + 5;

        if (maxDuration > 0) {
             newTime %= maxDuration;
        }
        
        // handleSeek utilise l'état isLooping actuel
        handleSeek(newTime);
    }, [isAudioReady, maxDuration, playbackTime, handleSeek]);


    // Logique de Drag-and-Drop pour les marqueurs de boucle (A et B)
    
    // Convertit une position en pixels (clientX) en temps (secondes)
    const positionToTime = useCallback((clientX: number): number => {
        if (!seekBarRef.current || maxDuration === 0) return 0;
        const rect = seekBarRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        let normalizedPosition = x / rect.width;
        normalizedPosition = Math.max(0, Math.min(normalizedPosition, 1));
        return normalizedPosition * maxDuration;
    }, [maxDuration]);

    // Gère le déplacement de la souris/touch
    const handleDrag = useCallback((clientX: number) => {
        if (isDraggingRef.current === null || maxDuration === 0) return;
        
        let newTime = positionToTime(clientX);
        
        if (isDraggingRef.current === 'start') {
            newTime = Math.min(newTime, loopEnd - 0.1); 
            setLoopStart(Math.max(0.01, newTime)); // Garder 0.01 comme minimum
        } else if (isDraggingRef.current === 'end') {
            newTime = Math.max(newTime, loopStart + 0.1);
            setLoopEnd(Math.min(maxDuration, newTime));
        }
    }, [maxDuration, loopStart, loopEnd, positionToTime]);

    // Fonction de nettoyage des listeners après le drag
    const handleDragEnd = useCallback(() => {
        if (isDraggingRef.current === null) return;
        
        isDraggingRef.current = null;
        
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
        
        // Optionnel: Appliquer la recherche à la nouvelle position de A/B si on était en lecture
        if (isAllPlaying) {
             // Redémarre l'audio pour appliquer les nouvelles bornes A/B
             handleSeek(playbackTime); 
        }

    }, [isAllPlaying, handleSeek, playbackTime]); 

    // Wrappers pour les listeners globaux
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        handleDrag(e.clientX);
    }, [handleDrag]);

    const handleGlobalMouseUp = useCallback(() => {
        handleDragEnd();
    }, [handleDragEnd]);

    const handleGlobalTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length > 0) {
            e.preventDefault(); 
            handleDrag(e.touches[0].clientX);
        }
    }, [handleDrag]);

    const handleGlobalTouchEnd = useCallback(() => {
        handleDragEnd();
    }, [handleDragEnd]);

    // Initialisation du drag (sur le marqueur)
    const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: 'start' | 'end') => {
        if ('touches' in e && e.touches.length > 0) {
            e.preventDefault();
        }
        
        isDraggingRef.current = type;
        
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false }); 
        document.addEventListener('touchend', handleGlobalTouchEnd);

    }, [handleGlobalMouseMove, handleGlobalMouseUp, handleGlobalTouchMove, handleGlobalTouchEnd]);

        
    // 6. Gestion du Volume (via GainNode)
    const handleVolumeChange = useCallback((name: string, newVolume: number) => {
        setStems(prevStems => prevStems.map(stem => {
            if (stem.name === name) {
                const finalVolume = stem.isMuted ? 0 : newVolume;
                if (stem.gainNode && audioContextRef.current) {
                    stem.gainNode.gain.setValueAtTime(finalVolume, audioContextRef.current.currentTime);
                }
                return { ...stem, volume: newVolume }; 
            }
            return stem;
        }));
    }, []);

    // 7. Gestion du Mute (via GainNode)
    const toggleMute = useCallback((name: string) => {
        setStems(prevStems => prevStems.map(stem => {
            if (stem.name === name) {
                const newMuteState = !stem.isMuted;
                if (stem.gainNode && audioContextRef.current) {
                    const finalVolume = newMuteState ? 0 : stem.volume;
                    stem.gainNode.gain.setValueAtTime(finalVolume, audioContextRef.current.currentTime);
                }
                return { ...stem, isMuted: newMuteState };
            }
            return stem;
        }));
    }, []);
    
    // Icônes dynamiques pour les stems
    const getStemIcon = (name: string) => {
        switch (name.toLowerCase()) {
            case 'vocals':
                return <Music className="w-5 h-5 text-red-500" />;
            case 'drums':
            case 'drum': 
                return <Disc3 className="w-5 h-5 text-blue-500" />;
            case 'bass':
                return <Aperture className="w-5 h-5 text-green-500" />;
            case 'other':
            default:
                return <Zap className="w-5 h-5 text-yellow-500" />;
        }
    }
    
    // Calcul du pourcentage de lecture pour la barre de progression (pour le style)
    const playbackPercent = maxDuration > 0 ? (playbackTime / maxDuration) * 100 : 0;

    // Affiche l'état de chargement
    if (isInitializing || !isAudioReady) {
        const loadedCount = stems.filter(s => s.buffer).length;
        const totalCount = stems.length;
        
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 font-inter">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p className="mt-4 text-gray-700 dark:text-gray-300">
                    {isInitializing && totalCount > 0 ? 
                     `Initialisation du studio... (Prépare ${totalCount} pistes)` : 
                     (totalCount > 0 ? 
                         `Chargement et décodage des pistes... (${loadedCount}/${totalCount})` : 
                         "Initialisation...")
                    }
                </p>
                {stems.some(s => s.hasLoadError) && (
                    <p className="mt-2 text-sm text-red-500 flex items-center">
                        <X className="w-4 h-4 mr-1"/>
                        Certaines pistes ont échoué au chargement ou au décodage.
                    </p>
                )}
            </div>
        );
    }

    if (!studioData) {
        return <div className="p-6 text-center text-red-500 dark:text-red-400">Erreur critique : Données de studio manquantes. Veuillez retourner à la bibliothèque.</div>;
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
                    <div className="w-24"></div> 
                </div>
                
                {/* --- BARRE DE LECTURE (PLAYER BAR) --- */}
                <Card className="mb-4 p-4 shadow-xl bg-gray-900 dark:bg-gray-900 text-white">
                    <div className="flex flex-col gap-4">
                        
                        {/* 1. Barre de Progression (Seek Bar) avec Temps */}
                        <div className="flex items-center w-full gap-3">
                            
                            {/* Temps Actuel */}
                            <span className="text-sm font-mono text-gray-300 w-12 text-left shrink-0">
                                {formatTime(playbackTime)}
                            </span>
                            
                            {/* Barre et Visualisation */}
                            <div className="flex-1 relative h-2" ref={seekBarRef}>
                                
                                {/* Piste de fond grise pour la barre (couche 1) */}
                                <div className="absolute inset-0 h-2 bg-gray-600 dark:bg-gray-700 rounded-full" />

                                {/* Visualisation de la zone de boucle (si active) (couche 2) */}
                                {isLooping && loopEnd > loopStart && (
                                    <div 
                                        className="absolute top-0 h-full bg-blue-500/30 rounded-full transition-all duration-100"
                                        style={{
                                            left: `${(loopStart / maxDuration) * 100}%`,
                                            width: `${((loopEnd - loopStart) / maxDuration) * 100}%`,
                                        }}
                                    />
                                )}
                                
                                {/* Range Input (Le fader lui-même et la progression blanche) (couche 3: z-10) */}
                                <input 
                                    type="range"
                                    min="0"
                                    max={maxDuration}
                                    step="0.01"
                                    value={playbackTime}
                                    onChange={(e) => {
                                        setPlaybackTime(parseFloat(e.target.value));
                                    }}
                                    onMouseUp={(e) => {
                                        handleSeek(parseFloat((e.target as HTMLInputElement).value));
                                    }}
                                    onTouchEnd={(e) => {
                                        handleSeek(parseFloat((e.target as HTMLInputElement).value));
                                    }}
                                    disabled={!isAudioReady || stems.some(s => s.hasLoadError)}
                                    className={`h-2 appearance-none rounded-full transition-colors flex-1 cursor-pointer w-full relative z-10`}
                                    style={{ 
                                        WebkitAppearance: 'none', 
                                        background: `linear-gradient(to right, 
                                            #ffffff ${playbackPercent}%, 
                                            transparent ${playbackPercent}%, 
                                            transparent 100%)`,
                                        opacity: 1, 
                                    } as React.CSSProperties}
                                />
                                
                                {/* Marqueur A (Loop Start) - Draggable (couche 4: z-20) */}
                                {maxDuration > 0 && (
                                    <div 
                                        className="absolute top-1/2 -translate-y-1/2 pointer-events-auto cursor-grab active:cursor-grabbing z-20" 
                                        style={{ left: `${(loopStart / maxDuration) * 100}%`, transform: 'translateX(-50%)' }}
                                        onMouseDown={(e) => handleDragStart(e, 'start')}
                                        onTouchStart={(e) => handleDragStart(e, 'start')}
                                    >
                                        <div className="w-5 h-5 bg-blue-600 rounded-full shadow-xl ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-xs font-bold text-white leading-none">A</div>
                                    </div>
                                )}
                                
                                {/* Marqueur B (Loop End) - Draggable (couche 4: z-20) */}
                                {maxDuration > 0 && (
                                    <div 
                                        className="absolute top-1/2 -translate-y-1/2 pointer-events-auto cursor-grab active:cursor-grabbing z-20" 
                                        style={{ left: `${(loopEnd / maxDuration) * 100}%`, transform: 'translateX(-50%)' }}
                                        onMouseDown={(e) => handleDragStart(e, 'end')}
                                        onTouchStart={(e) => handleDragStart(e, 'end')}
                                    >
                                        <div className="w-5 h-5 bg-red-600 rounded-full shadow-xl ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-xs font-bold text-white leading-none">B</div>
                                    </div>
                                )}
                            </div>

                            {/* Temps Restant (Calculé: maxDuration - playbackTime) */}
                            <span className="text-sm font-mono text-gray-300 w-12 text-right shrink-0">
                                -{formatTime(maxDuration - playbackTime)}
                            </span>
                        </div>
                        
                        {/* 2. Boutons de Contrôle */}
                        <div className="flex items-center justify-center gap-6">
                            
                            {/* Bouton Rewind 5s */}
                            <Button 
                                onClick={handleRewind} 
                                size="icon"
                                variant="secondary"
                                className="h-10 w-10 bg-transparent hover:bg-gray-800 text-white"
                                disabled={!isAudioReady || stems.some(s => s.hasLoadError)}
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </Button>

                            {/* Bouton Play/Pause Global */}
                            <Button 
                                onClick={toggleAllPlayback} 
                                size="icon"
                                variant="secondary"
                                className="h-12 w-12 bg-transparent hover:bg-gray-800 text-white"
                                disabled={!isAudioReady || stems.some(s => s.hasLoadError)}
                            >
                                {isAllPlaying ? (
                                    <Pause className="w-8 h-8 fill-white" /> 
                                ) : (
                                    <Play className="w-8 h-8 fill-white ml-1" /> 
                                )}
                            </Button>
                            
                            {/* Bouton Forward 5s */}
                            <Button 
                                onClick={handleForward} 
                                size="icon"
                                variant="secondary"
                                className="h-10 w-10 bg-transparent hover:bg-gray-800 text-white"
                                disabled={!isAudioReady || stems.some(s => s.hasLoadError)}
                            >
                                <ArrowRight className="w-6 h-6" />
                            </Button>

                        </div>
                    </div>
                </Card>
                {/* --- FIN BARRE DE LECTURE --- */}

                {/* --- CONTRÔLES DE BOUCLE (A-B Loop Controls) --- */}
                <Card className="mb-8 p-4 shadow-xl bg-gray-50 dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white flex-shrink-0">
                                Boucle (A-B)
                            </h3>
                            <Button 
                                onClick={toggleLoop} 
                                variant={isLooping ? "default" : "outline"}
                                className={isLooping ? "bg-green-600 hover:bg-green-700" : "text-gray-600 dark:text-gray-300"}
                                disabled={loopStart >= loopEnd}
                            >
                                <Repeat2 className="w-5 h-5 mr-2" />
                                {isLooping ? 'Boucle ON' : 'Boucle OFF'}
                            </Button>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button 
                                onClick={() => setLoopStart(Math.max(0.01, playbackTime))}
                                variant={"default"}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Marquer A 
                                <span className="ml-2 font-mono text-xs text-blue-200">({formatTime(loopStart)})</span>
                            </Button>
                            <Button 
                                onClick={() => setLoopEnd(Math.min(maxDuration, playbackTime))}
                                variant={"default"}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Marquer B 
                                <span className="ml-2 font-mono text-xs text-red-200">({formatTime(loopEnd)})</span>
                            </Button>
                        </div>
                    </div>
                    
                    {loopStart >= loopEnd && (
                        <p className="mt-2 text-sm text-red-500 dark:text-red-400 text-center">
                            ⚠️ Le point de début (A) doit être inférieur au point de fin (B) pour activer la boucle.
                        </p>
                    )}
                </Card>
                {/* --- FIN CONTRÔLES DE BOUCLE --- */}

                {/* Liste des Faders de Pistes */}
                <div className="space-y-4">
                    {stems.map((stem) => (
                        <Card key={stem.name} className={`p-4 transition-all duration-300 shadow-md ${stem.isPlaying && !stem.isMuted ? 'ring-2 ring-blue-500/70 border-blue-400' : 'hover:shadow-xl'}`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                
                                {getStemIcon(stem.name)}

                                <h3 className="flex-1 font-semibold text-lg capitalize truncate max-w-[200px] text-gray-900 dark:text-white">{stem.name}</h3>
                                
                                {/* Indicateur d'erreur de chargement */}
                                {stem.hasLoadError && (
                                    <span className="px-3 py-1 text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded-full shrink-0">
                                        ERREUR CHARGEMENT
                                    </span>
                                )}
                                
                                {/* Contrôle de Volume et Mute/Unmute */}
                                <div className="flex items-center gap-3 w-full sm:max-w-md">
                                    
                                    {/* Bouton Mute/Unmute */}
                                    <Button 
                                        size="icon" 
                                        variant={stem.isMuted ? "danger" : "secondary"}
                                        onClick={() => toggleMute(stem.name)}
                                        disabled={stem.hasLoadError || !isAudioReady}
                                        className={`transition-colors h-10 w-10 shrink-0 ${stem.hasLoadError ? 'opacity-50' : ''}`}
                                    >
                                        <Volume2 className={`w-5 h-5 ${stem.isMuted ? 'stroke-white' : 'text-gray-500 dark:text-gray-400'}`} />
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
                                        className={`h-2 appearance-none rounded-full bg-gray-300 dark:bg-gray-700 transition-colors flex-1 cursor-pointer ${stem.isMuted || stem.hasLoadError ? 'opacity-50' : ''}`}
                                        style={{ 
                                            WebkitAppearance: 'none', 
                                            background: `linear-gradient(to right, 
                                                #4f46e5 ${stem.volume * 100}%, 
                                                #e5e7eb ${stem.volume * 100}%, 
                                                #e5e7eb 100%)` 
                                        } as React.CSSProperties}
                                    />

                                    <span className="text-sm font-mono w-10 text-right text-gray-500 dark:text-gray-400 shrink-0">
                                        {Math.round(stem.volume * 100)}%
                                    </span>
                                </div>

                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}