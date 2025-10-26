import { useState, useEffect, useCallback } from "react";
import VideoCard from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// --- 1. Constantes d'API ---
const API_BASE_URL = "http://localhost:8080";

// Catégories (pour l'UI)
const filterCategories = ['All', 'Reggae', 'Hip Hop', 'Rock', 'Pop'];

// --- 2. Fonction de conversion de durée (et interfaces) ---
// ... (Gardez ici vos fonctions formatDuration et les interfaces Video/YoutubeApiResponse)
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

// NOTE: Le code de formatDuration doit être inclus ici
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
    // Changé en chaîne vide pour éviter la recherche au chargement
    const [searchQuery, setSearchQuery] = useState(""); 
    const [videos, setVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState("All");

    // --- Fonction de Récupération des Données (Déclenchée manuellement) ---
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

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const rawData: YoutubeApiResponse[] = await response.json(); 

            // Mapping des propriétés
            const formattedVideos: Video[] = rawData.map((video: YoutubeApiResponse) => ({
                id: video.videoId, 
                title: video.title,
                thumbnail: video.thumbnailUrl, 
                duration: video.duration, 
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
    }, []);
    
    // --- L'HOOK useEffect précédent est supprimé. ---
    // La recherche n'est plus automatique.

    // Gère la soumission du formulaire de recherche (le seul déclencheur d'API)
    interface SearchEvent extends React.FormEvent<HTMLFormElement> {}

    const handleSearch = (e: SearchEvent): void => {
      e.preventDefault();
      // Appel direct à l'API lors de la soumission du formulaire.
      fetchVideos(searchQuery); 
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="px-6 py-6 space-y-6">
                
                {/* Barre de Recherche et Bouton (Soumet le formulaire) */}
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

                {/* Filtres (UI) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {filterCategories.map((category) => (
                        <Button
                            key={category}
                            variant={selectedFilter === category ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setSelectedFilter(category)}
                            data-testid={`button-filter-${category.toLowerCase().replace(' ', '-')}`}
                        >
                            {category}
                        </Button>
                    ))}
                </div>

                {/* Affichage des Vidéos / État de Chargement / Erreur */}
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
                                onClick={() => console.log('Playing video:', video.title)}
                            />
                        ))
                    )}
                    
                    {/* Affiche un message si la recherche a été lancée mais n'a rien donné */}
                    {!isLoading && videos.length === 0 && !error && searchQuery && (
                        <p className="text-muted-foreground col-span-full">No videos found for "{searchQuery}". Try a different search.</p>
                    )}
                    
                    {/* Affiche un message pour encourager l'utilisateur à lancer la recherche */}
                    {!isLoading && videos.length === 0 && !error && !searchQuery && (
                        <p className="text-muted-foreground col-span-full">Enter a term and click "Search" to find videos.</p>
                    )}
                </div>
            </div>
        </div>
    );
}