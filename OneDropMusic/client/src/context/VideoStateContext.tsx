import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { toast } from 'react-hot-toast';

// --- CONSTANTES DE LOCAL STORAGE ---
const LS_SEARCH_QUERY_KEY = 'videoSearchQuery';
const LS_VIDEOS_KEY = 'videoResults';
const LS_TASK_STATUSES_KEY = 'videoTaskStatuses';

// --- DÉCLARATIONS DE TYPES (INTERFACES) ---

/** Représente les différents états possibles d'une tâche de séparation audio. */
export type TaskStatus = 'PENDING' | 'DOWNLOADING' | 'SEPARATING' | 'FAILED' | 'COMPLETED' | 'UNKNOWN' | undefined;

/** Représente la structure d'un objet vidéo. */
export interface Video {
    id: string;
    title: string;
    duration: number;
    channelTitle: string;
    thumbnailUrl: string;
}

/** Représente l'état des statuts de tâche par ID de vidéo. */
export interface TaskStatuses {
    [videoId: string]: TaskStatus;
}

// --- NOUVELLES INTERFACES POUR LE LECTEUR AUDIO GLOBAL ---

/** * Fonctions de contrôle du lecteur audio (définies et fournies par le composant Separator 
 * qui gère l'instance Web Audio). 
 */
export interface PlayerControls {
  togglePlayPause?: () => void;
  seek?: (time: number) => void;
}

/** Informations de base sur la piste en cours de lecture. */
export interface VideoInfo {
  id: string | null;
  title: string | null;
  artist: string | null; // Assumé être le channelTitle ou autre
}

const DEFAULT_VIDEO_INFO: VideoInfo = {
    id: null,
    title: null,
    artist: null,
};

const DEFAULT_PLAYER_CONTROLS: PlayerControls = {};


/** Représente la structure complète du contexte de l'état des vidéos et du lecteur. */
export interface VideoStateContextType {
    // Propriétés de Recherche et Tâches (Existantes)
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    videos: Video[];
    isLoading: boolean;
    error: string | null;
    taskStatuses: TaskStatuses;
    fetchVideos: (query: string) => Promise<void>;
    handleProcessVideo: (videoId: string) => Promise<void>;

    // Propriétés du Lecteur Audio (Nouveau)
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    videoInfo: VideoInfo;
    
    // Fonctions pour mettre à jour l'état du lecteur
    updateCurrentTime: (time: number) => void;
    updateDuration: (duration: number) => void;

    // Fonctions pour définir les contrôles exposés par le composant de lecture (Separator)
    playerControls: PlayerControls;
    setPlayerControls: React.Dispatch<React.SetStateAction<PlayerControls>>;
    setVideoInfo: React.Dispatch<React.SetStateAction<VideoInfo>>;
}

// --- CONTEXTE ---
// Nous devons initialiser le contexte avec un objet VideoStateContextType complet.
const initialContextValue: VideoStateContextType = {
    searchQuery: '',
    setSearchQuery: () => {},
    videos: [],
    isLoading: false,
    error: null,
    taskStatuses: {},
    fetchVideos: async () => {},
    handleProcessVideo: async () => {},

    isPlaying: false,
    currentTime: 0,
    duration: 0,
    videoInfo: DEFAULT_VIDEO_INFO,
    
    updateCurrentTime: () => {},
    updateDuration: () => {},

    playerControls: DEFAULT_PLAYER_CONTROLS,
    setPlayerControls: () => {},
    setVideoInfo: () => {},
};

export const VideoStateContext = createContext<VideoStateContextType>(initialContextValue);

// Constantes API (à déplacer dans un fichier config si le projet grandit)
const API_BASE_URL = "http://127.0.0.1:8080";

// --- HOOK UTILITAIRE ---
export const useVideoState = (): VideoStateContextType => {
    const context = useContext(VideoStateContext);
    if (!context) {
        // Cette erreur ne devrait jamais se produire si le Provider est utilisé correctement
        throw new Error('useVideoState must be used within a VideoStateProvider');
    }
    return context;
};

// --- FONCTIONS UTILITAIRES DE LOCAL STORAGE ---

/**
 * Charge l'état initial d'une clé spécifique depuis localStorage.
 * CORRECTION: Utilisation d'une déclaration de fonction traditionnelle pour les génériques
 * afin d'éviter les problèmes de compilation de la syntaxe de fonction fléchée générique.
 */
function loadInitialState<T>(key: string, defaultValue: T): T {
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
            // Utiliser un `as T` ici pour forcer le type, car JSON.parse retourne 'any'
            return JSON.parse(storedValue) as T;
        }
    } catch (error) {
        // L'erreur est typée comme 'unknown' par défaut, ce qui est mieux que 'any'
        console.error(`Error loading state from localStorage for key ${key}:`, error);
        localStorage.removeItem(key);
    }
    return defaultValue;
};

// --- PROPS DU PROVIDER ---
interface VideoStateProviderProps {
    children: ReactNode;
}


// --- PROVIDER ---
export const VideoStateProvider: React.FC<VideoStateProviderProps> = ({ children }) => {
    // Chargement de l'état initial depuis localStorage (Existants)
    const [searchQuery, setSearchQuery] = useState<string>(
        loadInitialState(LS_SEARCH_QUERY_KEY, '')
    );
    const [videos, setVideos] = useState<Video[]>(
        loadInitialState(LS_VIDEOS_KEY, [])
    );
    const [taskStatuses, setTaskStatuses] = useState<TaskStatuses>(
        loadInitialState(LS_TASK_STATUSES_KEY, {})
    );

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    // --- NOUVEAUX ÉTATS POUR LE LECTEUR AUDIO ---
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [videoInfo, setVideoInfo] = useState<VideoInfo>(DEFAULT_VIDEO_INFO);

    // Contient les fonctions de lecture/pause/recherche fournies par le composant `Separator`
    const [playerControls, setPlayerControls] = useState<PlayerControls>(DEFAULT_PLAYER_CONTROLS);
    
    // Fonctions exposées pour mettre à jour l'état du lecteur
    const updateCurrentTime = useCallback((time: number) => {
        setCurrentTime(time);
        // Utiliser aussi le isPlaying pour le MusicPlayer
        if (time > 0) {
            setIsPlaying(true);
        } else {
            // Optionnel : si le temps revient à 0, cela peut indiquer la fin de la lecture
        }
    }, []);

    const updateDuration = useCallback((d: number) => {
        setDuration(d);
    }, []);
    
    // Si playerControls.togglePlayPause est appelé, on bascule aussi l'état isPlaying
    useEffect(() => {
        // Ce useEffect est uniquement pour mettre à jour isPlaying lorsque playerControls est défini.
        // La vraie mise à jour de isPlaying sera faite par le composant Separator via updateCurrentTime ou un autre mécanisme
        
        // C'est un point de synchronisation délicat. Pour l'instant, nous faisons confiance
        // au composant Separator pour mettre à jour l'état `isPlaying` via une fonction
        // qu'il exposera ou via l'observation de `currentTime`.
        // Simplifions en ajoutant une fonction explicite à `PlayerControls` pour contrôler `isPlaying`.
        
        // Si vous modifiez Separator.tsx, assurez-vous qu'il appelle setCurrentTime
        // dans sa boucle audio, et qu'il appelle isPlaying quand il démarre/s'arrête.
        
        // Pour l'instant, on laisse isPlaying géré par updateCurrentTime (si > 0) et par le MusicPlayer
    }, [playerControls]);


    // --- LOGIQUE DE PERSISTANCE VERS LOCAL STORAGE (Existantes) ---

    useEffect(() => {
        // Utilisation de JSON.stringify() pour s'assurer que même les chaînes vides sont stockées
        localStorage.setItem(LS_SEARCH_QUERY_KEY, JSON.stringify(searchQuery));
    }, [searchQuery]);

    useEffect(() => {
        // Sauvegarde des vidéos
        localStorage.setItem(LS_VIDEOS_KEY, JSON.stringify(videos));
    }, [videos]);

    useEffect(() => {
        // Sauvegarde de l'état des tâches
        localStorage.setItem(LS_TASK_STATUSES_KEY, JSON.stringify(taskStatuses));
    }, [taskStatuses]);


    // --- LOGIQUE DE FETCH DES VIDÉOS (inchangée) ---
    const fetchVideos = useCallback(async (query: string) => {
        if (!query) {
            setVideos([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/videos?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch videos from the backend.');
            }
            const data: any[] = await response.json(); 
            
            const mappedVideos: Video[] = data.map(v => ({
                id: v.id,
                title: v.title,
                duration: v.duration,
                channelTitle: v.channelTitle,
                thumbnailUrl: v.thumbnailUrl
            }));
            
            setVideos(mappedVideos);

        } catch (err) {
            const errorMessage = (err as Error).message || "An unknown error occurred during search.";
            console.error("Fetch error:", err);
            setError(errorMessage);
            setVideos([]);
        } finally {
            setIsLoading(false);
        }
    }, []); 

    // --- LOGIQUE DU TRAITEMENT (inchangée) ---
    const handleProcessVideo = useCallback(async (videoId: string) => {
        const currentStatus = taskStatuses[videoId];
        
        if (currentStatus && (currentStatus !== 'FAILED' && currentStatus !== undefined)) {
            toast.error(`Processing is already ${currentStatus.toLowerCase()} for this video.`);
            return;
        }

        setTaskStatuses(prev => ({ ...prev, [videoId]: 'PENDING' }));
        const toastId = toast.loading(`Lancement du traitement pour ${videoId}...`);

        try {
            const encodedVideoId = encodeURIComponent(videoId);
            const url = `${API_BASE_URL}/api/audio/process?videoId=${encodedVideoId}`; 

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Server failed to start processing: ${response.status} - ${errorBody}`);
            }
            
            toast.success(`Traitement accepté (202 Accepted). Démarrage du suivi de statut.`, { id: toastId });
        } catch (err) {
            console.error("Process initiation error:", err);
            setTaskStatuses(prev => ({ ...prev, [videoId]: 'FAILED' }));
            toast.error(`Échec du lancement du traitement.`, { id: toastId });
        }
    }, [taskStatuses]);


    // --- LOGIQUE DE POLLING DE STATUT (inchangée) ---
    const pollTaskStatus = useCallback(async (videoId: string, currentStatus: TaskStatus) => {
        const encodedVideoId = encodeURIComponent(videoId);
        const url = `${API_BASE_URL}/api/audio/status?videoId=${encodedVideoId}`; 
        
        try {
            const response = await fetch(url);
            
            if (response.status === 404) {
                if (currentStatus !== undefined) {
                    setTaskStatuses(prev => ({ ...prev, [videoId]: 'FAILED' }));
                    toast.error(`Status check failed for ${videoId}. Task disappeared.`, { id: videoId });
                    return true;
                }
                return false;
            }

            if (!response.ok) { 
                throw new Error(`Status API failed with status: ${response.status}`);
            }
            
            const rawStatus = await response.text();
            const status = rawStatus.trim() as TaskStatus; 
            
            const validStatuses: TaskStatus[] = ['PENDING', 'DOWNLOADING', 'SEPARATING', 'FAILED', 'COMPLETED', 'UNKNOWN'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status received: ${rawStatus}`);
            }
            
            if (status !== currentStatus) {
                setTaskStatuses(prev => ({ ...prev, [videoId]: status }));
                
                if (status === 'SEPARATING') {
                    toast.loading('Separating audio tracks (Spleeter)...', { id: videoId });
                } else if (status === 'DOWNLOADING') {
                    toast.loading('Downloading audio...', { id: videoId });
                } else if (status === 'PENDING') {
                    toast.loading(`Task started, waiting for execution...`, { id: videoId });
                }
            }
            
            if (status === 'COMPLETED') {
                toast.success(`Processing COMPLETE for ${videoId}!`, { id: videoId });
                return true; 
            }
            if (status === 'FAILED') {
                toast.error(`Processing FAILED for ${videoId}.`, { id: videoId });
                return true; 
            }
            
            return false; // Continuer le polling
            
        } catch (error) {
            console.error(`Polling failed for ${videoId}:`, error);
            setTaskStatuses(prev => ({ ...prev, [videoId]: 'FAILED' }));
            toast.error(`Polling failed for ${videoId}. Check console.`, { id: videoId });
            return true; // Arrêter le polling
        }
    }, [taskStatuses]);

    // --- useEffect de Polling (Gère l'intervalle, inchangé) ---
    useEffect(() => {
        const activeTasks = Object.entries(taskStatuses).filter(([, status]) => 
            status === 'DOWNLOADING' || status === 'SEPARATING' || status === 'PENDING'
        );

        if (activeTasks.length === 0) return;

        const intervalId = setInterval(() => {
            activeTasks.forEach(([videoId, status]) => {
                pollTaskStatus(videoId, status as TaskStatus);
            });
        }, 3000); // Polling toutes les 3 secondes

        return () => clearInterval(intervalId);
    }, [taskStatuses, pollTaskStatus]);


    const contextValue: VideoStateContextType = {
        // Existants
        searchQuery,
        setSearchQuery,
        videos,
        isLoading,
        error,
        taskStatuses,
        fetchVideos,
        handleProcessVideo,
        
        // Nouveaux
        isPlaying,
        currentTime,
        duration,
        videoInfo,
        updateCurrentTime,
        updateDuration,
        playerControls,
        setPlayerControls,
        setVideoInfo,
    };

    return (
        <VideoStateContext.Provider value={contextValue}>
            {children}
        </VideoStateContext.Provider>
    );
};