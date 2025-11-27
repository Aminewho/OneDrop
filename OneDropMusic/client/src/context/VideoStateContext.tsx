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

/** Représente la structure complète du contexte de l'état des vidéos. */
export interface VideoStateContextType {
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    videos: Video[];
    isLoading: boolean;
    error: string | null;
    taskStatuses: TaskStatuses;
    fetchVideos: (query: string) => Promise<void>;
    handleProcessVideo: (videoId: string) => Promise<void>;
}

// --- CONTEXTE ---
export const VideoStateContext = createContext<VideoStateContextType | null>(null);

// Constantes API (à déplacer dans un fichier config si le projet grandit)
const API_BASE_URL = "http://localhost:8080";

// --- HOOK UTILITAIRE ---
export const useVideoState = (): VideoStateContextType => {
    const context = useContext(VideoStateContext);
    if (!context) {
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
    // Chargement de l'état initial depuis localStorage
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

    // --- LOGIQUE DE PERSISTANCE VERS LOCAL STORAGE ---

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
        searchQuery,
        setSearchQuery,
        videos,
        isLoading,
        error,
        taskStatuses,
        fetchVideos,
        handleProcessVideo
    };

    return (
        <VideoStateContext.Provider value={contextValue}>
            {children}
        </VideoStateContext.Provider>
    );
};
