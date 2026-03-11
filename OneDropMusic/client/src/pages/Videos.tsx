import { useState, useEffect, useCallback } from "react";
import VideoCard from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-hot-toast"; // Assurez-vous d'avoir installé react-hot-toast

// --- 1. CONSTANTES & TYPES ---
const API_BASE_URL = "http://localhost:8081";

// Clés Local Storage
const LS_SEARCH_QUERY_KEY = 'videoSearchQuery_page';
const LS_VIDEOS_KEY = 'videoResults_page';
const LS_TASK_STATUSES_KEY = 'videoTaskStatuses_page';

// Type de statut (doit correspondre au backend TaskStatusManager.java)
export type TaskStatus = 'PENDING' | 'DOWNLOADING' | 'SEPARATING' | 'FAILED' | 'COMPLETED' | 'UNKNOWN' | undefined;
// Interfaces
interface YoutubeApiResponse {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    publishedAt: string;
    duration: string;
}

interface Video {
    id: string;
    title: string;
    thumbnail: string;
    duration: string;
    channel: string;
    uploadedAt: string;
}

const filterCategories = ['All', 'Reggae', 'Hip Hop', 'Rock', 'Pop'];

// --- 2. FONCTION UTILITAIRE : LOCAL STORAGE HOOK ---
/**
 * Un hook simple pour gérer l'état avec persistance dans localStorage.
 */
function useLocalStorageState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    // Fonction pour charger l'état initial (similaire à loadInitialState précédent)
    const loadInitialState = (): T => {
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue) {
                // Utilisation de JSON.parse pour récupérer les objets/arrays
                return JSON.parse(storedValue) as T;
            }
        } catch (error) {
            console.error(`Error loading state from localStorage for key ${key}:`, error);
            localStorage.removeItem(key); // Nettoyer les données corrompues
        }
        return defaultValue;
    };

    const [state, setState] = useState<T>(loadInitialState);

    // Effet pour persister l'état dans localStorage à chaque changement
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error saving state to localStorage for key ${key}:`, error);
        }
    }, [key, state]);

    return [state, setState];
}

// --- 3. FONCTION UTILITAIRE : FORMAT DURATION ---
function formatDuration(isoDuration: string | null | undefined): string {
    if (!isoDuration || typeof isoDuration !== 'string') return 'N/A';
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = isoDuration.match(regex);
    if (!matches) return 'N/A';

    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);

    const parts: string[] = [];
    if (hours > 0) {
        parts.push(hours.toString());
        parts.push(minutes.toString().padStart(2, '0'));
    } else {
        parts.push(minutes.toString());
    }
    parts.push(seconds.toString().padStart(2, '0'));

    return parts.join(':');
}
// -----------------------------------------------------------------------------

export default function Videos() {
    // 🛑 Utilisation du hook useLocalStorageState pour la persistance
    const [searchQuery, setSearchQuery] = useLocalStorageState<string>(LS_SEARCH_QUERY_KEY, ""); 
    const [videos, setVideos] = useLocalStorageState<Video[]>(LS_VIDEOS_KEY, []);
    // Le statut des tâches est un objet, donc nous utilisons l'objet vide {} par défaut
    const [taskStatuses, setTaskStatuses] = useLocalStorageState<Record<string, TaskStatus>>(LS_TASK_STATUSES_KEY, {});

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState("All");

    // --- Fonction de Récupération des Vidéos ---
    const fetchVideos = useCallback(async (query: string) => {
        if (!query.trim()) {
            setVideos([]);
            setError("Please enter a search term.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setVideos([]); 
        
        try {
            const encodedQuery = encodeURIComponent(query);
            const url = `${API_BASE_URL}/search/youtube?q=${encodedQuery}`;

            const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const rawData: YoutubeApiResponse[] = await response.json(); 

            const formattedVideos: Video[] = rawData.map((video: YoutubeApiResponse) => ({
                id: video.videoId, 
                title: video.title,
                thumbnail: video.thumbnailUrl, 
                duration: formatDuration(video.duration), // Utilisez formatDuration ici
                channel: video.channelTitle,
                uploadedAt: new Date(video.publishedAt).toLocaleDateString(), 
            }));

            setVideos(formattedVideos);

        } catch (err) {
            console.error("Fetch error:", err);
            setError(`Failed to fetch videos. Details: ${err instanceof Error ? err.message : 'An unknown error occurred'}`);
        } finally {
            setIsLoading(false);
        }
    }, [setVideos]); // Dépendance ajoutée pour le hook de localStorage

    
    // --- FONCTION PRINCIPALE : Lancement du Traitement Audio ---
    const handleProcessVideo = useCallback(async (videoId: string) => {
        const currentStatus = taskStatuses[videoId];
        
        if (currentStatus && (currentStatus !== 'FAILED' && currentStatus !== undefined)) {
            toast.error(`Processing is already ${currentStatus.toLowerCase()} for this video.`);
            return;
        }

        // 1. Mettre à jour l'état local pour démarrer l'observation
        setTaskStatuses(prev => ({ ...prev, [videoId]: 'PENDING' }));
        const toastId = toast.loading(`Lancement du traitement pour ${videoId}...`);

        try {
            // Format de l'URL pour le POST : /process?videoId=...
            const encodedVideoId = encodeURIComponent(videoId);
            const url = `${API_BASE_URL}/api/audio/process`; 

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: videoId ,duration: videos.find(v => v.id === videoId)?.duration,videoTitle: videos.find(v => v.id === videoId)?.title

                }) // Envoyer le videoId dans le corps de la requête
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Server failed to start processing: ${response.status} - ${errorBody}`);
            }
            
            // 2. Succès : Le back-end a accepté la tâche et l'a lancée en ASYNCHRONE.
            toast.success(`Traitement accepté (202 Accepted). Démarrage du suivi de statut.`, { id: toastId });

        } catch (err) {
            console.error("Process initiation error:", err);
            setTaskStatuses(prev => ({ ...prev, [videoId]: 'FAILED' }));
            toast.error(`Échec du lancement du traitement.`, { id: toastId });
        }
    }, [taskStatuses, setTaskStatuses]); // Dépendance ajoutée pour le hook de localStorage

    // --- LOGIQUE DE POLLING DE STATUT ---
    const pollTaskStatus = useCallback(async (videoId: string, currentStatus: TaskStatus) => {
        
        // Format de l'URL pour le GET : /status?videoId=...
        const encodedVideoId = encodeURIComponent(videoId);
        const url = `${API_BASE_URL}/api/audio/status?videoId=${encodedVideoId}`; 
        
        try {
            const response = await fetch(url);
            
            if (response.status === 404) {
                // Tâche non trouvée (le back-end renvoie UNKNOWN/404)
                if (currentStatus !== undefined) {
                    // Si on était en train de suivre la tâche et qu'elle disparaît, c'est un échec
                    setTaskStatuses(prev => ({ ...prev, [videoId]: 'FAILED' }));
                    toast.error(`Status check failed for ${videoId}. Task disappeared.`, { id: videoId });
                    return true; // Arrêter le polling
                }
                return false; // Continuer, peut-être que le POST n'a pas encore mis à jour la map
            }

            if (!response.ok) { 
                throw new Error(`Status API failed with status: ${response.status}`);
            }
            
            // Récupérer le corps de la réponse comme texte (chaîne de statut: PENDING, DOWNLOADING, etc.)
            const rawStatus: string = await response.text();
            const status = rawStatus.trim() as TaskStatus; 
            
            const validStatuses: TaskStatus[] = ['PENDING', 'DOWNLOADING', 'SEPARATING', 'FAILED', 'COMPLETED', 'UNKNOWN', undefined];
            if (!validStatuses.includes(status)) {
                 throw new Error(`Invalid status received: ${rawStatus}`);
            }
            
            // Si le statut a changé, mettre à jour le front-end
            if (status !== currentStatus) {
                setTaskStatuses(prev => ({ ...prev, [videoId]: status }));
                
                if (status === 'SEPARATING') {
                    toast.loading('Separating audio tracks (Spleeter)...', { id: videoId });
                } else if (status === 'DOWNLOADING') {
                    toast.loading('Downloading audio...', { id: videoId });
                } else {
                    toast.loading(`Status update: ${status}...`, { id: videoId });
                }
            }
            
            if (status === 'COMPLETED') {
                toast.success(`Processing COMPLETE for ${videoId}!`, { id: videoId });
                return true; // Polling terminé
            }
            if (status === 'FAILED') {
                toast.error(`Processing FAILED for ${videoId}.`, { id: videoId });
                return true; // Polling terminé
            }
            
            return false; // Continuer le polling
            
        } catch (error) {
            console.error(`Polling failed for ${videoId}:`, error);
            // Marquer l'échec seulement si c'est un échec réseau ou d'API critique
            setTaskStatuses(prev => ({ ...prev, [videoId]: 'FAILED' }));
            toast.error(`Polling failed for ${videoId}. Check console.`, { id: videoId });
            return true; // Arrêter le polling
        }
    }, [setTaskStatuses]); // Dépendance ajoutée pour le hook de localStorage

    // --- GESTION DE L'INTERVALLE DE POLLING ---
    useEffect(() => {
        // Polling loop pour toutes les tâches en cours
        const activeTasks = Object.entries(taskStatuses).filter(([, status]) => 
            status === 'DOWNLOADING' || status === 'SEPARATING' || status === 'PENDING'
        );

        if (activeTasks.length === 0) return;

        const intervalId = setInterval(() => {
            activeTasks.forEach(([videoId, status]) => {
                // On utilise `status as TaskStatus` pour lever l'erreur TypeScript si le status est undefined
                pollTaskStatus(videoId, status as TaskStatus);
            });
        }, 3000); // Polling toutes les 3 secondes

        return () => clearInterval(intervalId);
    }, [taskStatuses, pollTaskStatus]);

    // Gère la soumission du formulaire de recherche
    interface SearchEvent extends React.FormEvent<HTMLFormElement> {}

    const handleSearch = (e: SearchEvent): void => {
      e.preventDefault();
      fetchVideos(searchQuery); 
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="px-6 py-6 space-y-6">
                
                {/* Barre de Recherche et Filtres */}
                <form onSubmit={handleSearch} className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search videos (e.g., Bob Marley)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                            data-testid="input-search"
                        />
                    </div>
                    <Button type="submit" data-testid="button-search" disabled={isLoading || searchQuery.trim() === ""}>
                        {isLoading ? 'Searching...' : 'Search'}
                    </Button>
                </form>
                

                {/* Affichage des Vidéos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    
                    {error && <p className="text-red-500 col-span-full">{error}</p>}
                    
                    {isLoading ? (
                        Array.from({ length: 8 }).map((_, index) => (
                            <div key={`skeleton-${index}`} className="space-y-3">
                                <Skeleton className="h-[225px] w-full rounded-xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[75%]" />
                                    <Skeleton className="h-4 w-[50%]" />
                                </div>
                            </div>
                        ))
                    ) : (
                        videos.map((video) => (
                            <VideoCard
                                key={video.id}
                                video={video}
                                onProcess={handleProcessVideo} 
                                // Transmission du statut (undefined si non existant)
                                taskStatus={taskStatuses[video.id] || undefined} 
                            />
                        ))
                    )}
                    
                    {/* Messages d'état */}
                    {!isLoading && videos.length === 0 && !error && searchQuery && (
                        <p className="text-muted-foreground col-span-full">No videos found for "{searchQuery}". Try a different search.</p>
                    )}
                    
                    {!isLoading && videos.length === 0 && !error && !searchQuery && (
                        <p className="text-muted-foreground col-span-full">Enter a term and click "Search" to find videos.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
