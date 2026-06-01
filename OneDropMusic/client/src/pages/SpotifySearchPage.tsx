import React, { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter'; 
import { toast } from 'react-hot-toast';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Search, Zap, Music, Loader2, User, TrendingUp, Users, 
    PlayCircle, Play, ArrowLeft, Disc, X, Calendar, Clock, Youtube
} from 'lucide-react'; 
import { 
    useSpotifyApi, 
    SpotifySearchResults, 
    UserProfile, 
    Artist 
} from '../components/useSpotifyApi'; 
import AlertModal from "@/components/AlertModal";

// --- Interfaces ---

interface SearchItem {
    id: string;
    type: 'track' | 'artist' | 'album';
    name: string;
    description: string; 
    image_url: string;
    external_url: string;
    artists: { id: string; name: string }[]; 
    uri: string; 
}

interface AlbumData {
    id: string;
    name: string;
    image: string;
    releaseDate: string;
    totalTracks: number;
    spotifyUrl: string;
}

interface AlbumTrackData {
    id: string;
    name: string;
    durationMs: number;
    trackNumber: number;
    artists: { name: string }[];
    spotifyUrl: string;
}

// Interface pour gérer l'état de la vidéo en cours de traitement
interface ProcessingTrackState {
    spotifyTrack: SearchItem;
    youtubeId: string | null;
    isSearchingYoutube: boolean;
    isSendingToSpleeter: boolean;
}
type TaskStatus = 'PENDING' | 'DOWNLOADING' | 'SEPARATING' | 'FAILED' | 'COMPLETED' | 'UNKNOWN' | undefined;
type ActiveTab = 'All' | 'Tracks' | 'Artists' | 'Albums';

// --- Configuration ---
// ⚠️ IMPORTANT : Remplacez ceci par votre clé API Google Cloud
const YOUTUBE_API_KEY = "AIzaSyDEYDLuOqwcFQyomz8UwYTrMChjY_nSFks"; 
const BACKEND_BASE_URL = "http://localhost:8081"; // Base URL de votre proxy/backend

// --- Helpers ---

const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// --- Sub-Components ---

interface ArtistListProps {
    title: string;
    icon: React.ElementType;
    artists: Artist[] | null; 
    color: string;
    onArtistClick: (artistId: string, artistName: string) => void; 
}

const ArtistList: React.FC<ArtistListProps> = ({ title, icon: Icon, artists, color, onArtistClick }) => {
    if (!artists || artists.length === 0) {
        return (
            <div className="p-3 bg-muted/50 rounded-lg h-full">
                <h4 className="font-semibold flex items-center mb-2 text-sm">
                    <Icon className={`w-4 h-4 mr-2 ${color}`} />
                    {title}
                </h4>
                <p className="text-xs text-muted-foreground">No data found.</p>
            </div>
        );
    }

    return (
        <div className="p-3 bg-muted/50 rounded-lg h-full flex flex-col">
            <h4 className="font-semibold flex items-center mb-3 text-sm">
                <Icon className={`w-4 h-4 mr-2 ${color}`} />
                {title}
            </h4>
            <ul className="space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar"> 
                {artists.slice(0, 50).map((artist) => ( 
                    <li 
                        key={artist.id} 
                        onClick={() => onArtistClick(artist.id, artist.name)}
                        className="flex items-center text-sm p-2 rounded-md hover:bg-background/80 hover:shadow-sm cursor-pointer transition-all group"
                    >
                        <img 
                            src={artist.images?.[2]?.url || ''} 
                            alt={artist.name} 
                            className="w-8 h-8 rounded-full object-cover mr-3 border border-border/50"
                        />
                        <span className="truncate flex-1 font-medium text-foreground/90 group-hover:text-primary transition-colors">
                            {artist.name}
                        </span>
                        <PlayCircle className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                    </li>
                ))}
            </ul>
        </div>
    );
};

// --- Main Component ---

export default function SpotifySearchPage() {
    // --- USER DATA STATES ---
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [topArtists, setTopArtists] = useState<Artist[] | null>(null);
    const [followingArtists, setFollowingArtists] = useState<Artist[] | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true); 
// Place this with your other useState hooks
const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
    // --- SEARCH STATES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('All');
    const [searchResults, setSearchResults] = useState<SpotifySearchResults>({
        tracks: [], artists: [], albums: [],
    });

    // --- DETAIL VIEW STATES ---
    const [artistTracksView, setArtistTracksView] = useState<{ artistName: string, tracks: any[] } | null>(null);
    const [artistAlbums, setArtistAlbums] = useState<AlbumData[]>([]);
    const [selectedAlbum, setSelectedAlbum] = useState<{ details: AlbumData, tracks: AlbumTrackData[] } | null>(null);
    const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);

    // --- PROCESSING STATE (Youtube + Spleeter) ---
    const [activeProcessingTrack, setActiveProcessingTrack] = useState<ProcessingTrackState | null>(null);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [, setLocation] = useLocation();
    
    // Hooks Spotify
    const { 
        isLoggedIn, 
        searchSpotify, 
        getUserProfile, 
        getTopArtists, 
        getFollowingArtists,
        getArtistTopTracks,
        getArtistAlbums, 
        getAlbumTracks   
    } = useSpotifyApi();
// --- Polling Logic ---
const pollTaskStatus = useCallback(async (videoId: string, currentStatus: TaskStatus) => {
    try {
        // 1. Force cache busting with a timestamp
        const url = `${BACKEND_BASE_URL}/api/audio/status?videoId=${encodeURIComponent(videoId)}&t=${Date.now()}`;
        const response = await fetch(url);
        
        if (response.status === 404) return false;

        // 2. Get raw text
        const rawText = await response.text();
        
        // 3. Clean the string: Remove quotes, newlines (\n), and carriage returns (\r)
        // Then convert to Uppercase to match your TaskStatus type
        const status = rawText.trim().replace(/['"«»]/g, '').toUpperCase() as TaskStatus;

        // Debugging: This will show you exactly what is happening in the console
        console.log(`[POLL] ID: ${videoId} | Raw: "${rawText}" | Cleaned: ${status} | Local: ${currentStatus}`);

        // 4. Update state only if it changed
        if (status !== currentStatus) {
          setTaskStatuses((prev: Record<string, TaskStatus>) => ({ ...prev, [videoId]: status }));
            // Toast updates
            if (status === 'SEPARATING') toast.loading('Separating stems...', { id: videoId });
            else if (status === 'COMPLETED') toast.success('Ready!', { id: videoId });
            else if (status === 'FAILED') toast.error('Process failed.', { id: videoId });
        }
        
        return status === 'COMPLETED' || status === 'FAILED';
    } catch (error) {
        console.error("Polling error:", error);
        return true; 
    }
}, []);

// Automatically start polling when a task enters a processing state
useEffect(() => {
    // Identify which videos are currently in a "working" state
    const activeTasks = Object.entries(taskStatuses).filter(([_, status]) =>
        ['PENDING', 'DOWNLOADING', 'SEPARATING'].includes(status || '')
    );

    if (activeTasks.length === 0) return;

    // Start the interval
    const intervalId = setInterval(() => {
        activeTasks.forEach(([videoId, status]) => {
            pollTaskStatus(videoId, status as TaskStatus);
        });
    }, 3000); // 3 seconds is ideal for simple text backends

    return () => clearInterval(intervalId);
}, [taskStatuses, pollTaskStatus]);

const CustomPlayButton = ({ onClick, className = "" }: { onClick: () => void, className?: string }) => (
    <Button 
        size="icon"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`rounded-full h-10 w-10 bg-white hover:bg-white/90 shadow-md transition-transform hover:scale-110 active:scale-95 group ${className}`}
    >
        <Play className="h-5 w-5 fill-black text-black ml-0.5" />
    </Button>
);
    // --- 1. Load User Data ---
    useEffect(() => {
        if (!isLoggedIn) {
            setUserProfile(null);
            setIsLoadingProfile(false);
            return;
        }

        const fetchUserData = async () => {
            setIsLoadingProfile(true);
            try {
                const profile = await getUserProfile();
                setUserProfile(profile);
                const top = await getTopArtists();
                setTopArtists(top.items);
                const following = await getFollowingArtists();
                setFollowingArtists(following.artists.items); 
            } catch (e) {
                console.error("Error fetching user data:", e);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        fetchUserData();
    }, [isLoggedIn, getUserProfile, getTopArtists, getFollowingArtists]); 


    // --- 2. Youtube Search Logic ---
    const findYouTubeVideo = async (track: SearchItem) => {
        if (!YOUTUBE_API_KEY) {
            toast.error("API Key YouTube manquante dans le code !");
            return null;
        }

        // Requête précise : Artiste + Titre + "official audio"
        const query = encodeURIComponent(`${track.artists[0]?.name} ${track.name} `);
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&key=${YOUTUBE_API_KEY}&maxResults=1&type=video`;
console.log("YouTube Search URL:", query);
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                return data.items[0].id.videoId;
            } else {
                return null;
            }
        } catch (error) {
            console.error("YouTube Search Error:", error);
            return null;
        }
    };


    // --- 3. Handle Process Click (Trigger Youtube Search) ---
    const handleProcessTrack = async (trackItem: SearchItem) => {
        // Scroll to top to see the player
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setActiveProcessingTrack({
            spotifyTrack: trackItem,
            youtubeId: null,
            isSearchingYoutube: true,
            isSendingToSpleeter: false
        });

        const videoId = await findYouTubeVideo(trackItem);
        
        if (videoId) {
            setActiveProcessingTrack({
                spotifyTrack: trackItem,
                youtubeId: videoId,
                isSearchingYoutube: false,
                isSendingToSpleeter: false
            });
            toast.success("Vidéo YouTube correspondante trouvée !");
        } else {
            setActiveProcessingTrack(null);
            toast.error("Impossible de trouver une vidéo correspondante sur YouTube.");
        }
    };

    // --- 4. Execute Spleeter (Call Backend) ---
    const executeSpleeter = async () => {
    if (!activeProcessingTrack || !activeProcessingTrack.youtubeId) return;

    const videoId = activeProcessingTrack.youtubeId;

    setActiveProcessingTrack(prev => prev ? ({ ...prev, isSendingToSpleeter: true }) : null);
    setTaskStatuses(prev => ({ ...prev, [videoId]: 'PENDING' }));

    const toastId = toast.loading("Launching Spleeter...");

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/audio/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId: videoId,
                videoTitle: activeProcessingTrack.spotifyTrack.name,
                duration: "0"
            })
        });

        if (response.status === 409) {
            const msg = await response.text();
            console.log('[409] Already processed:', msg);
            toast.dismiss(toastId);
            setTaskStatuses(prev => { const n = {...prev}; delete n[videoId]; return n; });
            setAlertMessage(msg);
            return;
        }

        if (!response.ok) throw new Error("Server rejected request");

        toast.success("Task queued successfully", { id: toastId });

    } catch (error) {
        setTaskStatuses(prev => { const n = {...prev}; delete n[videoId]; return n; });
        toast.error("Failed to start spleeter", { id: toastId });
    } finally {
        setActiveProcessingTrack(prev => prev ? ({ ...prev, isSendingToSpleeter: false }) : null);
    }
};
    // --- 5. Artist & Album Navigation ---
    const handleArtistClick = async (artistId: string, artistName: string) => {
        if (isSearching) return;
        setIsSearching(true);
        setSearchResults({ tracks: [], artists: [], albums: [] });
        setSearchQuery('');
        setSelectedAlbum(null);
        setActiveProcessingTrack(null); // Hide player on navigation
        
        try {
            const [tracksData, albumsData] = await Promise.all([
                getArtistTopTracks(artistId),
                getArtistAlbums(artistId)
            ]);
            
            setArtistTracksView({ artistName, tracks: tracksData });

            if (albumsData && albumsData.items) {
                const mappedAlbums: AlbumData[] = albumsData.items.map((album: any) => ({
                    id: album.id,
                    name: album.name,
                    image: album.images?.[1]?.url || album.images?.[0]?.url || '',
                    releaseDate: album.release_date,
                    totalTracks: album.total_tracks,
                    spotifyUrl: album.external_urls.spotify
                }));
                setArtistAlbums(mappedAlbums);
            } else {
                setArtistAlbums([]);
            }
            setActiveTab('Tracks');
        } catch (error) {
            console.error(error);
            toast.error("Failed to load artist details");
        } finally {
            setIsSearching(false);
        }
    };

    const handleAlbumClick = async (album: AlbumData) => {
        setIsLoadingAlbum(true);
        try {
            const tracksData = await getAlbumTracks(album.id);
            if (tracksData && tracksData.items) {
                const mappedTracks: AlbumTrackData[] = tracksData.items.map((track: any) => ({
                    id: track.id,
                    name: track.name,
                    durationMs: track.duration_ms,
                    trackNumber: track.track_number,
                    artists: track.artists,
                    spotifyUrl: track.external_urls.spotify
                }));
                setSelectedAlbum({ details: album, tracks: mappedTracks });
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load album tracks");
        } finally {
            setIsLoadingAlbum(false);
        }
    };

    const handleReturnToSearch = () => {
        setArtistTracksView(null);
        setArtistAlbums([]);
        setSelectedAlbum(null);
        setSearchQuery(''); 
        setSearchResults({ tracks: [], artists: [], albums: [] }); 
        setActiveTab('All');
        setActiveProcessingTrack(null);
    }

    const mapSpotifyItem = (item: any, type: 'track' | 'artist' | 'album'): SearchItem => {
        switch (type) {
            case 'track':
                return {
                    id: item.id,
                    type: 'track',
                    name: item.name,
                    description: `${item.artists.map((a: any) => a.name).join(', ')} • ${formatDuration(item.duration_ms)}`,
                    image_url: item.album.images?.[0]?.url || '',
                    external_url: item.external_urls.spotify,
                    artists: item.artists.map((a: any) => ({ id: a.id, name: a.name })),
                    uri: item.uri,
                };
            case 'artist':
                return {
                    id: item.id,
                    type: 'artist',
                    name: item.name,
                    description: `Artist • ${item.followers?.total.toLocaleString() || 'N/A'} followers`,
                    image_url: item.images?.[0]?.url || '',
                    external_url: item.external_urls.spotify,
                    artists: [], uri: '',
                };
            case 'album':
                return {
                    id: item.id,
                    type: 'album',
                    name: item.name,
                    description: `Album • ${item.artists.map((a: any) => a.name).join(', ')}`,
                    image_url: item.images?.[0]?.url || '',
                    external_url: item.external_urls.spotify,
                    artists: [], uri: '',
                };
        }
    };
    
 const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim() || !isLoggedIn) return;

    setIsSearching(true);
    // ... tes autres resets (setArtistTracksView, etc.)
    setSearchResults({ tracks: [], artists: [], albums: [] });
    setActiveTab('All'); 

    try {
        const results = await searchSpotify(searchQuery); 
        
        // --- LA LOGIQUE DE FILTRAGE ICI ---
        const filteredResults = {
            ...results,
            // On ne garde que le premier artiste s'il existe
            artists: results.artists && results.artists.length > 0 
                ? [results.artists[0]] 
                : [],
            // On garde toutes les chansons (jusqu'à 15 selon ta config backend)
            tracks: results.tracks || []
        };

        setSearchResults(filteredResults);
        
        const total = filteredResults.tracks.length + filteredResults.artists.length;
        if (total === 0) toast("No results found.", { icon: '🔍' });

    } catch (error) {
        console.error("Search failed:", error);
        toast.error("An error occurred during search.");
    } finally {
        setIsSearching(false);
    }
}, [searchQuery, isLoggedIn, searchSpotify]);

    // --- RENDERERS ---

  const renderProcessingSection = () => {
    if (!activeProcessingTrack) return null;
    // Get the status for the current video from your taskStatuses state
    const currentStatus = activeProcessingTrack.youtubeId 
        ? taskStatuses[activeProcessingTrack.youtubeId] 
        : undefined;

    // Determine if we are currently "busy"
    const isWorking = activeProcessingTrack.isSendingToSpleeter || 
        ['PENDING', 'DOWNLOADING', 'SEPARATING'].includes(currentStatus || '');
    return (
        /* Sticky container with z-index to stay above search results */
        <div className="sticky top-4 z-40 mb-8 animate-in slide-in-from-top-4 duration-300">
            <Card className="p-6 border-2 border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Zap className="text-yellow-500 fill-yellow-500" /> 
                            Spleeter Workstation
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            Track: <span className="font-semibold text-foreground">{activeProcessingTrack.spotifyTrack.name}</span>
                        </p>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setActiveProcessingTrack(null)}
                        className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>
<AlertModal
    message={alertMessage}
    onClose={() => setAlertMessage(null)}
    title="Already Processed"
    variant="warning"
/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: YouTube Player with Auto-start */}
                    <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg border border-border">
                        {activeProcessingTrack.isSearchingYoutube ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                                <Loader2 className="w-10 h-10 animate-spin mb-3 text-primary" />
                                <p>Finding the best audio source...</p>
                            </div>
                        ) : activeProcessingTrack.youtubeId ? (
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${activeProcessingTrack.youtubeId}?autoplay=1`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-red-500">
                                <X className="w-8 h-8 mr-2" /> Source not found
                            </div>
                        )}
                    </div>

                    {/* Right Column: Spleeter Action & Help */}
                    <div className="flex flex-col justify-center space-y-4">
                        <div className="p-4 bg-accent/5 rounded-md border text-sm text-muted-foreground shadow-sm">
                            <h4 className="font-semibold text-foreground mb-1 flex items-center">
                                <Youtube className="w-4 h-4 mr-2 text-red-500"/> 
                                Audio Source Detected
                            </h4>
                            <p className="mb-3">
                                Click below to start extracting audio stems (Vocals, Drums, Bass...).
                            </p>
                            <div className="pt-2 border-t border-border/50 italic text-[11px]">
                                💡 If this version doesn't satisfy you, try using the <strong>YouTube Search</strong> tab for more options.
                            </div>
                        </div>
                        
                        <Button 
                            className="w-full h-16 text-lg font-bold shadow-lg transition-all transform hover:scale-[1.01] active:scale-95 bg-blue-600 hover:bg-blue-500"
                            disabled={activeProcessingTrack.isSearchingYoutube || isWorking || !activeProcessingTrack.youtubeId}
                            onClick={executeSpleeter}
                        >
                            {isWorking ? (
                                <>
                                    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                    {currentStatus === 'SEPARATING' ? 'SEPARATING STEMS...' : 
                                    currentStatus === 'DOWNLOADING' ? 'DOWNLOADING AUDIO...' : 'STARTING...'}
                                </>
                            ) : currentStatus === 'COMPLETED' ? (
                                <>
                                    <Music className="mr-3 h-6 w-6" />
                                    SEPARATION COMPLETE!
                                </>
                            ) : currentStatus === 'FAILED' ? (
                                <>
                                    <Zap className="mr-3 h-6 w-6 fill-white" />
                                    RETRY SPLEETER
                                </>
                            ) : (
                                <>
                                    <Zap className="mr-3 h-6 w-6 fill-white" />
                                    EXECUTE SPLEETER
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

    const renderSearchResults = () => {
        let itemsToDisplay: SearchItem[] = [];

        if (activeTab === 'All') {
            const tracks = searchResults.tracks.map(t => mapSpotifyItem(t, 'track'));
            const artists = searchResults.artists.map(a => mapSpotifyItem(a, 'artist'));
            const albums = searchResults.albums.map(a => mapSpotifyItem(a, 'album'));
            itemsToDisplay = [...artists, ...tracks, ...albums]; 
        } else if (activeTab === 'Tracks') {
            itemsToDisplay = searchResults.tracks.map(t => mapSpotifyItem(t, 'track'));
        } else if (activeTab === 'Artists') {
            itemsToDisplay = searchResults.artists.map(a => mapSpotifyItem(a, 'artist'));
        } else if (activeTab === 'Albums') {
            itemsToDisplay = searchResults.albums.map(a => mapSpotifyItem(a, 'album'));
        }
        
        if (isSearching) {
            return (
                <div className="text-center p-8 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Fetching data...
                </div>
            );
        }

        if (itemsToDisplay.length === 0 && searchQuery.length > 0) {
           return <div className="text-center p-8 text-muted-foreground">No {activeTab.toLowerCase()} results found.</div>;
        }

        return (
            <div className="space-y-2">
                {itemsToDisplay.map((item) => (
                    <Card key={`${item.type}-${item.id}`} className="hover-elevate transition-all duration-200 hover:bg-accent/5">
                        <div className="flex items-center gap-4 p-3 sm:p-4">
                            <div className={`relative w-12 h-12 bg-muted flex items-center justify-center overflow-hidden 
                                    ${item.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}>
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Music className="w-6 h-6 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold uppercase text-primary/70 mr-2">{item.type}</span>
                                <h3 className="font-medium truncate">{item.name}</h3>
                                <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                            </div>
                            
                            {/* Actions Buttons */}
                            {item.type === 'artist' && (
                                <Button size="sm" variant="outline" onClick={() => handleArtistClick(item.id, item.name)}>
                                    View Artist
                                </Button>
                            )}
                            {item.type === 'track' && (
                             <CustomPlayButton 
     // Utilise "icon" pour un bouton parfaitement carré/rond
    onClick={() => handleProcessTrack(item)} 
    className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-full h-10 w-10 shrink-0 shadow-sm transition-transform hover:scale-110 active:scale-95"
/>
                            )}
                             {item.type === 'album' && (
                                <Button size="sm" variant="ghost" disabled>
                                    Album
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        );
    };

    const renderArtistDetailView = () => {
        if (!artistTracksView) return null;

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <section>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Top Tracks
                    </h3>
                    <div className="space-y-2">
                        {artistTracksView.tracks.map((t: any) => {
                            const item = mapSpotifyItem(t, 'track');
                            return (
                                <Card key={item.id} className="hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-4 p-3">
                                        <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{item.name}</div>
                                            <div className="text-xs text-muted-foreground">{item.description}</div>
                                        </div>
                                        <Card key={item.id} className="p-3 flex items-center gap-4 hover:bg-accent/5">
                                            {/* ... image et infos ... */}
                                            <CustomPlayButton onClick={() => handleProcessTrack(item)}
                                                className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-full h-10 w-10 shrink-0 shadow-sm transition-transform hover:scale-110 active:scale-95"
 />
                                        </Card>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Disc className="w-5 h-5 text-primary" />
                        Albums & Singles
                    </h3>
                    {artistAlbums.length === 0 ? (
                        <div className="text-muted-foreground italic">No albums found.</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {artistAlbums.map((album) => (
                                <div 
                                    key={album.id} 
                                    onClick={() => handleAlbumClick(album)}
                                    className="group cursor-pointer space-y-2"
                                >
                                    <div className="relative aspect-square bg-muted rounded-md overflow-hidden shadow-sm transition-all group-hover:shadow-md group-hover:scale-105">
                                        {album.image ? (
                                            <img src={album.image} alt={album.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <Disc className="w-6 h-6" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            {isLoadingAlbum ? (
                                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                                            ) : (
                                                <div >
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm truncate" title={album.name}>{album.name}</h4>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <span>{album.releaseDate.split('-')[0]}</span>
                                            <span>•</span>
                                            <span>{album.totalTracks} tracks</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        );
    }

    // --- MAIN RENDER ---

    const totalResults = searchResults.tracks.length + searchResults.artists.length + searchResults.albums.length;
    const shouldShowResultsSection = totalResults > 0;
    
    return (
        <div className="container mx-auto p-4 max-w-4xl relative">
            
            {/* --- ALBUM MODAL --- */}
            {selectedAlbum && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-background border-border shadow-2xl">
                        <div className="p-4 border-b flex items-start gap-4 bg-muted/30">
                            <div className="w-24 h-24 rounded-md overflow-hidden shadow-md flex-shrink-0">
                                <img src={selectedAlbum.details.image} alt={selectedAlbum.details.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold">{selectedAlbum.details.name}</h2>
                                <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                                    <Calendar className="w-3 h-3" /> {selectedAlbum.details.releaseDate}
                                    <span className="mx-1">•</span>
                                    <Music className="w-3 h-3" /> {selectedAlbum.details.totalTracks} tracks
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedAlbum(null)}>
                                <X className="w-6 h-6" />
                            </Button>
                        </div>

                        <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
                            {selectedAlbum.tracks.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">No tracks found.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="text-left text-muted-foreground border-b">
                                        <tr>
                                            <th className="p-2 w-10">#</th>
                                            <th className="p-2">Title</th>
                                            <th className="p-2 text-right"><Clock className="w-4 h-4 ml-auto" /></th>
                                            <th className="p-2 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedAlbum.tracks.map((track) => (
    <tr 
        key={track.id} 
        // 1. On déplace le clic sur toute la ligne
        onClick={() => handleProcessTrack({
            id: track.id, 
            type: 'track', 
            name: track.name, 
            image_url: selectedAlbum.details.image,
            artists: track.artists.map((a: any) => ({ id: a.id || '0', name: a.name })), 
            description: '', 
            external_url: track.spotifyUrl, 
            uri: ''
        } as SearchItem)}
        // 2. On ajoute cursor-pointer pour indiquer que c'est cliquable
        className="hover:bg-accent/50 group transition-colors cursor-pointer"
    >
        <td className="p-2 text-muted-foreground">{track.trackNumber}</td>
        <td className="p-2 font-medium">
            <div className="truncate text-foreground">{track.name}</div>
            <div className="truncate text-xs text-muted-foreground">
                {track.artists.map(a => a.name).join(', ')}
            </div>
        </td>
        <td className="p-2 text-right text-muted-foreground font-mono">
            {formatDuration(track.durationMs)}
        </td>
        
        <td className="p-2 text-right">
            {/* 3. On garde le bouton pour le visuel, mais il n'a plus besoin de son propre onClick */}
               <CustomPlayButton 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100" 
                    onClick={() => handleProcessTrack({
                        id: track.id, 
                        type: 'track', 
                        name: track.name, 
                        image_url: selectedAlbum.details.image,
                        // Correction : On passe les vrais artistes au lieu de []
                        artists: track.artists.map((a: any) => ({ id: a.id || '0', name: a.name })), 
                        description: '', 
                        external_url: track.spotifyUrl, 
                        uri: ''
                    } as SearchItem)} 
                />
       </td>
    </tr>
            ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </div>
            )}


            {/* --- CONNECTION STATUS --- */}
            {!isLoggedIn && (
                <Card className="p-4 border-l-4 border-red-500 bg-red-900/10 mb-6 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Zap className="w-6 h-6 text-red-400" />
                        <div>
                            <h3 className="font-semibold text-red-300">Spotify Connection Required</h3>
                            <p className="text-sm text-red-400">Please connect your account to search their catalog.</p>
                        </div>
                    </div>
                    <Button onClick={() => setLocation('/spotify-callback')} className="bg-green-600 hover:bg-green-700">
                        Connect Spotify
                    </Button>
                </Card>
            )}
            

            {/* --- SEARCH FORM --- */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <Input
                    type="search"
                    placeholder={artistTracksView ? `Viewing ${artistTracksView.artistName}...` : "Search for tracks, artists, or albums..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={!isLoggedIn || isSearching || artistTracksView !== null} 
                    className="flex-1"
                />
                <Button type="submit" disabled={!isLoggedIn || isSearching || artistTracksView !== null} className="w-32">
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Search
                </Button>
            </form>

            {/* --- NEW: VIDEO PLAYER & PROCESSING --- */}
            {renderProcessingSection()}

            {/* --- DEFAULT VIEW (Profile) --- */}
            {renderUserProfile()}

            {/* --- RESULTS SECTION --- */}
            {(shouldShowResultsSection || artistTracksView) && (
                <section>
                    <div className="flex justify-between items-center pt-4 mb-4 border-b pb-2">
                      <div className="flex flex-col gap-1">
  <div className="flex items-center gap-3">
    {/* Bouton retour si on est dans la vue artiste */}
    {artistTracksView && (
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setArtistTracksView(null)}
        className="h-8 w-8 rounded-full hover:bg-accent"
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>
    )}
    
    <h2 className="text-2xl font-bold tracking-tight">
      {artistTracksView ? (
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground font-normal">Artist:</span> 
          {artistTracksView.artistName}
        </span>
      ) : (
        "Search Results"
      )}
    </h2>
  </div>

  {/* Sous-titre dynamique pour donner du contexte */}
  <p className="text-sm text-muted-foreground ml-1">
    {artistTracksView 
      ? `Showing top tracks and albums` 
      : searchQuery 
        ? `Top matches for "${searchQuery}"` 
        : "Discover new music"}
  </p>
</div>
                        
                   
                    </div>
                    
                    {!artistTracksView && (
                        <div className="flex flex-wrap gap-2 border-b pb-2 mb-4">
                           
                        </div>
                    )}
                    
                    {artistTracksView ? renderArtistDetailView() : renderSearchResults()}
                </section>
            )}
        </div>
    );

    // --- USER PROFILE HELPER ---
    function renderUserProfile() {
        if (!isLoggedIn || artistTracksView || searchQuery.length > 0 || activeProcessingTrack) return null; 

        if (isLoadingProfile) {
            return (
                <Card className="p-4 mb-6 flex items-center space-x-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading your Spotify data...</span>
                </Card>
            );
        }

        const profileImage = userProfile?.images?.[0]?.url;
        const displayName = userProfile?.display_name || userProfile?.id || 'User';

        return (
            <Card className="p-6 mb-6">
                <div className="flex items-center space-x-4 border-b pb-4 mb-4">
                    {profileImage ? (
                        <img src={profileImage} alt={displayName} className="w-16 h-16 rounded-full object-cover shadow-lg" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-8 h-8 text-primary" />
                        </div>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold flex items-center">Welcome, {displayName}!</h2>
                        <p className="text-sm text-muted-foreground">{userProfile?.email}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ArtistList 
                        title="Your Top Artists" 
                        icon={TrendingUp} 
                        artists={topArtists} 
                        color="text-green-500"
                        onArtistClick={handleArtistClick} 
                    />
                    <ArtistList 
                        title="Artists You Follow" 
                        icon={Users} 
                        artists={followingArtists} 
                        color="text-blue-500"
                        onArtistClick={handleArtistClick} 
                    />
                </div>
            </Card>
        );
    }
}