import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Play, MoreVertical, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-hot-toast";

// --- TYPES ---
interface ProcessedVideo {
  videoId: string;
  videoTitle: string;
  duration: string; // Le backend renvoie "MM:SS"
  status: string;
  processedAt: string;
}

interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  addedAt: string;
  status: string;
}

const API_BASE_URL = "http://localhost:8080";

export default function Library() {
  const [searchQuery, setSearchQuery] = useState("");
  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    const fetchLibrary = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/audio/videos`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch library: ${response.statusText}`);
        }

        const data: ProcessedVideo[] = await response.json();

        // Transformation des données du backend pour l'UI
        const formattedLibrary: LibraryTrack[] = data.map((video) => ({
          id: video.videoId,
          title: video.videoTitle,
          // Le backend ne renvoie pas l'artiste/chaîne pour l'instant, on met une valeur par défaut ou on pourrait l'extraire du titre
          artist: "Processed Audio", 
          duration: video.duration, // "5:04"
          // Construction de l'URL de la vignette YouTube
          thumbnail: `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
          // Formatage simple de la date
          addedAt: new Date(video.processedAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
          }),
          status: video.status
        }));

        setLibrary(formattedLibrary);
      } catch (err) {
        console.error("Error loading library:", err);
        setError("Impossible de charger votre bibliothèque.");
        toast.error("Erreur de chargement de la bibliothèque");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  // --- FILTRAGE ---
  const filteredLibrary = library.filter((track) =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fonction pour jouer (à connecter plus tard au lecteur)
  const handlePlay = (track: LibraryTrack) => {
    console.log("Playing:", track.title, "ID:", track.id);
    // Ici, vous pourrez appeler une fonction pour charger les pistes séparées (vocals, drums, etc.)
    // Exemple: playStems(track.id);
    toast.success(`Lecture de ${track.title}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Your Library</h1>
          <Button data-testid="button-add-music">
            <Music className="w-4 h-4 mr-2" />
            Add Music
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-library"
          />
        </div>

        <div className="space-y-2">
          {isLoading ? (
            // Skeletons de chargement
            Array.from({ length: 5 }).map((_, i) => (
               <div key={i} className="flex items-center space-x-4 p-4">
                 <Skeleton className="h-12 w-12 rounded-full" />
                 <div className="space-y-2 flex-1">
                   <Skeleton className="h-4 w-[250px]" />
                   <Skeleton className="h-4 w-[200px]" />
                 </div>
               </div>
            ))
          ) : error ? (
            <div className="text-center py-10 text-red-500">{error}</div>
          ) : filteredLibrary.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">
               Aucune piste trouvée. Commencez par traiter une vidéo dans l'onglet Recherche.
             </div>
          ) : (
            filteredLibrary.map((track) => (
              <Card key={track.id} className="hover-elevate transition-all duration-200 hover:bg-accent/5">
                <div className="flex items-center gap-4 p-4">
                  {/* Thumbnail avec bouton Play au survol */}
                  <div className="relative w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden group cursor-pointer"
                       onClick={() => handlePlay(track)}>
                    <img 
                      src={track.thumbnail} 
                      alt={track.title} 
                      className="w-full h-full object-cover transition-opacity group-hover:opacity-75" 
                      onError={(e) => {
                        // Fallback si l'image ne charge pas
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    {/* Fallback icon (caché si image ok) */}
                    <Music className="w-6 h-6 text-muted-foreground hidden absolute" />
                    
                    {/* Overlay Play Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                        <Play className="w-6 h-6 text-white fill-current" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate" data-testid={`text-track-title-${track.id}`}>
                      {track.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="truncate" data-testid={`text-track-artist-${track.id}`}>
                        {track.artist}
                        </span>
                        {track.status === 'COMPLETED' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                                READY
                            </span>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{track.duration}</span>
                    </div>
                    <span className="hidden sm:inline text-sm text-muted-foreground">{track.addedAt}</span>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handlePlay(track)}
                      data-testid={`button-play-${track.id}`}
                      className="hover:text-primary hover:bg-primary/10"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </Button>
                    
                    <Button size="icon" variant="ghost" data-testid={`button-more-${track.id}`}>
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}