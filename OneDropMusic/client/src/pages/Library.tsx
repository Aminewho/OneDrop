import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Play, Trash2, Clock, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-hot-toast";
import { useLocation } from "wouter";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";

// --- TYPES ---
interface ProcessedVideo {
  videoId: string;
  videoTitle: string;
  duration: string;
  status: string;
  processedAt: string;
  bpm?: number | null;
}

interface LibraryTrack {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  addedAt: string;
  status: string;
  bpm?: number | null;
}

const API_BASE_URL = "http://localhost:8081";

export default function Library() {
  const [searchQuery, setSearchQuery] = useState("");
  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // --- DELETE MODAL STATE ---
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<LibraryTrack | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- FETCH LIBRARY ---
  const fetchLibrary = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/audio/videos`);

      if (!response.ok) {
        throw new Error(`Failed to fetch library: ${response.statusText}`);
      }

      const data: ProcessedVideo[] = await response.json();

      const formattedLibrary: LibraryTrack[] = data.map((video) => ({
        id: video.videoId,
        title: video.videoTitle,
        duration: video.duration,
        thumbnail: `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
        addedAt: new Date(video.processedAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        status: video.status,
        bpm: video.bpm ?? null,
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

  useEffect(() => {
    fetchLibrary();
  }, []);

  // --- DELETE HANDLERS ---
  const handleOpenDeleteModal = (track: LibraryTrack) => {
    setTrackToDelete(track);
    setIsTrackModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setTrackToDelete(null);
    setIsTrackModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!trackToDelete) return;

    setIsDeleting(true);
    try {
      // Matches: DELETE http://localhost:8081/api/audio/videos/{id}
      const response = await fetch(`${API_BASE_URL}/api/audio/videos/${trackToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete track from backend");
      }

      toast.success("Piste supprimée avec succès");
      
      // Remove from UI state right away without triggering a full page re-fetch
      setLibrary((prev) => prev.filter((track) => track.id !== trackToDelete.id));
      handleCloseDeleteModal();
    } catch (err) {
      console.error("Error deleting track:", err);
      toast.error("Erreur lors de la suppression de la piste");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- STUDIO REDIRECT ---
  const handleOpenStudio = (track: LibraryTrack) => {
    if (track.status !== "COMPLETED") {
      toast.error("Le traitement audio n'est pas terminé. Veuillez patienter.");
      return;
    }

    const studioData = {
      videoId: track.id,
      trackTitle: track.title,
      bpm: track.bpm ?? null,
      stemNames: ["vocals", "drums", "bass", "other"],
    };

    localStorage.setItem("currentStudioData", JSON.stringify(studioData));
    setLocation("/separator");
  };

  // --- SEARCH FILTERING ---
  const filteredLibrary = library.filter((track) =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePlay = (track: LibraryTrack) => {
    handleOpenStudio(track);
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
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            ))
          ) : error ? (
<div className="text-center py-10 text-destructive">
  {error}
</div>          ) : filteredLibrary.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Aucune piste trouvée. Commencez par traiter une vidéo dans l'onglet Recherche.
            </div>
          ) : (
            filteredLibrary.map((track) => (
             <Card
                key={track.id}
                className="hover-elevate transition-all duration-200 hover:bg-accent"
              >
                <div className="flex items-center gap-4 p-4">
                  <div
                    className="relative w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden group cursor-pointer"
                    onClick={() => handlePlay(track)}
                  >
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove(
                          "hidden"
                        );
                      }}
                    />
                    <Music className="w-6 h-6 text-muted-foreground hidden absolute" />
                    {track.status === "COMPLETED" && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/40 backdrop-blur-sm transition-opacity">
                        <Play className="w-6 h-6 text-foreground fill-current" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-medium truncate"
                      data-testid={`text-track-title-${track.id}`}
                    >
                      {track.title}
                    </h3>
  
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{track.duration}</span>
                    </div>
                    <span className="hidden sm:inline text-sm text-muted-foreground">
                      {track.addedAt}
                    </span>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handlePlay(track)}
                      disabled={track.status !== "COMPLETED"}
                      data-testid={`button-play-${track.id}`}
                      className="hover:text-primary hover:bg-primary/10"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </Button>

                    {/* REPLACED: Old 3-dots menu icon is now a Trash action icon */}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDeleteModal(track)}
                      data-testid={`button-delete-${track.id}`}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      <div className="h-20"></div>

      {/* RENDER DYNAMIC DELETE MODAL */}
   <DeleteConfirmationModal
  isOpen={isTrackModalOpen}
  onClose={handleCloseDeleteModal}
  onConfirm={handleConfirmDelete}
  title="Delete track?"
  description={`Are you sure you want to permanently delete "${trackToDelete?.title}"?`}
  isDeleting={isDeleting}
/>
    </div>
  );
}

