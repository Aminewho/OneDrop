import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'react-hot-toast';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Search, Zap, Music, Loader2, TrendingUp, 
    PlayCircle, Play, Disc, X, Calendar, Clock, Youtube
} from 'lucide-react'; 
import { 
    useSpotifyApi, 
    SpotifySearchResults, 
    Artist 
} from '../components/useSpotifyApi'; 
import AlertModal from "@/components/AlertModal";
import { useSearchHistory } from '@/hooks/useSearchHistory';
import SearchHistoryDropdown from '@/components/SearchHistoryDropdown';

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
    durationMs?: number;
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
// Local storage key for preserving page state
const STORAGE_KEY = 'spotify_search_page_state_v1';

// --- Helpers ---

const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatDurationIso = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let duration = 'PT';
    if (hours > 0) duration += `${hours}H`;
    if (minutes > 0 || hours > 0) duration += `${minutes}M`;
    if (seconds > 0 || (!hours && !minutes)) duration += `${seconds}S`;

    return duration;
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
    // --- SEARCH STATES ---
    const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
    // --- SEARCH STATES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('All');
    const [searchResults, setSearchResults] = useState<SpotifySearchResults>({
        tracks: [], artists: [], albums: [],
    });
   const hasSearched = useRef(false);    // --- DETAIL VIEW STATES ---
    const [artistTracksView, setArtistTracksView] = useState<{ artistName: string, tracks: any[] } | null>(null);
    const [artistAlbums, setArtistAlbums] = useState<AlbumData[]>([]);
    const [selectedAlbum, setSelectedAlbum] = useState<{ details: AlbumData, tracks: AlbumTrackData[] } | null>(null);
    const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);
const [isDropdownVisible, setIsDropdownVisible] = useState(false);

// Initialisation de la logique d'historique connectée à Spring Boot
const { history, push, remove, clear } = useSearchHistory("spotify")
    // --- PROCESSING STATE (Youtube + Spleeter) ---
    const [activeProcessingTrack, setActiveProcessingTrack] = useState<ProcessingTrackState | null>(null);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [, setLocation] = useLocation();
    
    // Hooks Spotify
    const {
        searchSpotify,
        getArtistTopTracks,
        getArtistAlbums,
        getAlbumTracks,
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
    // --- 1. Youtube Search Logic ---
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

    // --- 2. Get YouTube Video Duration ---
    const getYouTubeVideoDuration = async (videoId: string): Promise<number | null> => {
        if (!YOUTUBE_API_KEY) return null;

        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const iso8601Duration = data.items[0].contentDetails.duration; // e.g., "PT4M32S"
                // Convert ISO 8601 to milliseconds
                const match = iso8601Duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                if (match) {
                    const hours = parseInt(match[1] || '0');
                    const minutes = parseInt(match[2] || '0');
                    const seconds = parseInt(match[3] || '0');
                    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
                    return totalMs;
                }
            }
            return null;
        } catch (error) {
            console.error("YouTube Duration fetch error:", error);
            return null;
        }
    };

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
            // Fetch the real YouTube video duration
            const youtubeDurationMs = await getYouTubeVideoDuration(videoId);
            
            // Update the track item with YouTube duration (if available)
            if (youtubeDurationMs !== null) {
                trackItem.durationMs = youtubeDurationMs;
            }

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
                duration: formatDurationIso(activeProcessingTrack.spotifyTrack.durationMs ?? 0)
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
                    durationMs: item.duration_ms,
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
    
const handleSearch = useCallback(async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    
    // Si une customQuery est fournie (clic historique), on utilise celle-ci, sinon le state
    const queryToSearch = customQuery !== undefined ? customQuery : searchQuery;
    const trimmed = queryToSearch.trim();
    
    if (!trimmed) return;
    
    hasSearched.current = true;
    setIsSearching(true);
    setArtistTracksView(null);
    setArtistAlbums([]);
    setSelectedAlbum(null);
    setActiveProcessingTrack(null);
    setSearchResults({ tracks: [], artists: [], albums: [] });
    setActiveTab('All');
    
    // Fermer le dropdown dès que la recherche commence
    setIsDropdownVisible(false);

    try {
        // Sauvegarde de manière optimiste dans le localStorage + DB Spring Boot
        push(trimmed);

        const results = await searchSpotify(trimmed);

        const filteredResults = {
            ...results,
            artists: results.artists && results.artists.length > 0
                ? [results.artists[0]]
                : [],
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
}, [searchQuery, searchSpotify, push]);

// --- Persistence: load saved state from localStorage on mount ---
useEffect(() => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed: any = JSON.parse(raw);

        if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
        if (parsed.searchResults) setSearchResults(parsed.searchResults);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
        if (parsed.artistTracksView) setArtistTracksView(parsed.artistTracksView);
        if (parsed.artistAlbums) setArtistAlbums(parsed.artistAlbums);
        if (parsed.selectedAlbum) setSelectedAlbum(parsed.selectedAlbum);
        if (parsed.activeProcessingTrack) setActiveProcessingTrack(parsed.activeProcessingTrack);
        if (parsed.taskStatuses) setTaskStatuses(parsed.taskStatuses);
    } catch (err) {
        console.warn('Failed to restore Spotify page state:', err);
    }
}, []);

// Save relevant state to localStorage whenever it changes
useEffect(() => {
    try {
        const toSave = {
            searchQuery,
            searchResults,
            activeTab,
            artistTracksView,
            artistAlbums,
            selectedAlbum,
            activeProcessingTrack,
            taskStatuses
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
        console.warn('Failed to persist Spotify page state:', err);
    }
}, [searchQuery, searchResults, activeTab, artistTracksView, artistAlbums, selectedAlbum, activeProcessingTrack, taskStatuses]);

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
    <Card className="overflow-hidden border border-border/60 bg-card shadow-lg">

        {/* ── Top accent bar (uses --primary, changes with theme) ── */}
        <div className="h-0.5 w-full bg-primary/60" />

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-3 min-w-0">
                {/* Animated status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                    isWorking
                        ? "bg-primary animate-pulse"
                        : currentStatus === "COMPLETED"
                        ? "bg-green-500"
                        : "bg-muted-foreground/30"
                }`} />
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Stem Extraction
                    </p>
                    <p className="text-sm font-semibold text-foreground truncate">
                        {activeProcessingTrack.spotifyTrack.name}
                    </p>
                </div>
            </div>
            <button
                onClick={() => setActiveProcessingTrack(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all shrink-0 ml-4"
            >
                <X className="w-4 h-4" />
            </button>
        </div>

        <AlertModal
            message={alertMessage}
            onClose={() => setAlertMessage(null)}
            title="Already Downloaded"
            variant="warning"
        />

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border/40">

            {/* Left: Video embed */}
            <div className="p-4">
                <div className="aspect-video rounded-xl overflow-hidden bg-muted/30 border border-border/40">
                    {activeProcessingTrack.isSearchingYoutube ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm">Finding best source…</p>
                        </div>
                    ) : activeProcessingTrack.youtubeId ? (
                        <iframe
                            width="100%" height="100%"
                            src={`https://www.youtube.com/embed/${activeProcessingTrack.youtubeId}?autoplay=1`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <X className="w-8 h-8 text-destructive/50" />
                            <p className="text-sm">No source found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Info + action */}
            <div className="p-4 flex flex-col justify-between gap-4">

                {/* Info box */}
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3 text-sm flex-1">
                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            <Youtube className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-sm">Source detected</p>
                            <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                                Ready to separate into Vocals, Drums, Bass and Other.
                            </p>
                        </div>
                    </div>

                    {/* Stems preview pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {["Vocals", "Drums", "Bass", "Other"].map(stem => (
                            <span key={stem}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40 uppercase tracking-wide">
                                {stem}
                            </span>
                        ))}
                    </div>

                    <p className="text-[11px] text-muted-foreground/60 pt-1 border-t border-border/30 leading-relaxed">
                        Wrong version?{" "}
                        <span className="text-primary cursor-pointer hover:underline">
                            Use YouTube Search
                        </span>{" "}
                        to pick another source.
                    </p>
                </div>

                {/* Execute button */}
                <button
                    disabled={activeProcessingTrack.isSearchingYoutube || isWorking || !activeProcessingTrack.youtubeId}
                    onClick={executeSpleeter}
                    className={`
                        w-full h-12 rounded-xl text-sm font-semibold tracking-wide
                        flex items-center justify-center gap-2.5
                        transition-all duration-200 active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${currentStatus === "COMPLETED"
                            ? "bg-green-500/15 text-green-600 border border-green-500/30 hover:bg-green-500/20"
                            : currentStatus === "FAILED"
                            ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
                        }
                    `}
                >
                    {isWorking ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {currentStatus === "SEPARATING" ? "Separating stems…"
                            : currentStatus === "DOWNLOADING" ? "Downloading…"
                            : "Starting…"}
                        </>
                    ) : currentStatus === "COMPLETED" ? (
                        <><Music className="w-4 h-4" /> Extraction complete</>
                    ) : currentStatus === "FAILED" ? (
                        <><Zap className="w-4 h-4" /> Retry extraction</>
                    ) : (
                        <><Zap className="w-4 h-4" /> Extract stems</>
                    )}
                </button>
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
    <div className="min-h-screen bg-background">
            
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
                                        <tr key={track.id}
                                            onClick={() => handleProcessTrack({ id: track.id, type: 'track', name: track.name, image_url: selectedAlbum.details.image, artists: track.artists.map((a: any) => ({ id: a.id || '0', name: a.name })), description: '', external_url: track.spotifyUrl, uri: '', durationMs: track.durationMs } as SearchItem)}
                                            className="hover:bg-accent/50 group transition-colors cursor-pointer">
                                            <td className="p-2 text-muted-foreground">{track.trackNumber}</td>
                                            <td className="p-2 font-medium">
                                                <div className="truncate text-foreground">{track.name}</div>
                                                <div className="truncate text-xs text-muted-foreground">{track.artists.map(a => a.name).join(', ')}</div>
                                            </td>
                                            <td className="p-2 text-right text-muted-foreground font-mono">{formatDuration(track.durationMs)}</td>
                                            <td className="p-2 text-right">
                                                <CustomPlayButton className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                                    onClick={() => handleProcessTrack({ id: track.id, type: 'track', name: track.name, image_url: selectedAlbum.details.image, artists: track.artists.map((a: any) => ({ id: a.id || '0', name: a.name })), description: '', external_url: track.spotifyUrl, uri: '', durationMs: track.durationMs } as SearchItem)} />
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

        {/* ── Shared search bar ─────────────────────────────────────────── */}
     {/* ── Shared search bar ─────────────────────────────────────────── */}
{(() => {
    const searchBar = (
        <form onSubmit={(e) => handleSearch(e)} className="flex gap-3 items-center w-full">
            <div className="relative flex-1">
                {/* Spotify logo mark */}
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="hsl(var(--primary))">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                </div>
                
          <Input
    type="search"
    placeholder={artistTracksView ? `Viewing ${artistTracksView.artistName}…` : "Search tracks, artists or albums…"}
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    
    // 1. Ouvrir le dropdown au focus
    onFocus={() => setIsDropdownVisible(true)}
    
    // 2. Le onBlur ne doit s'exécuter QUE si on ne clique pas sur Entrée
    onBlur={(e) => {
        // On laisse le temps au clic de la souris de s'exécuter
        setTimeout(() => setIsDropdownVisible(false), 200);
    }}

    // 3. CAPTURE DE LA TOUCHE ENTRÉE
    onKeyDown={(e) => {
        if (e.key === 'Enter') {
            // On force la soumission immédiate sans attendre le floutage de l'input
            e.preventDefault(); 
            handleSearch(); 
            setIsDropdownVisible(false); // On ferme proprement après
        }
    }}
    disabled={isSearching}
    className="pl-11 pr-4 h-12 bg-card border-border/50 focus:border-primary/50 transition-colors text-sm placeholder:text-muted-foreground/50 rounded-xl shadow-sm"
/>

                {/* Insertion du Dropdown réutilisable configuré pour Spotify */}
                <SearchHistoryDropdown
                    history={history}
                    visible={isDropdownVisible}
                    onRemove={remove}
                    onClear={clear}
                    onSelect={(query) => {
                        setSearchQuery(query);
                        // Lance la recherche immédiatement au clic sur un ancien mot-clé
                        handleSearch(undefined, query);
                    }}
                />
            </div>
            <Button type="submit" disabled={isSearching} className="h-12 px-6 rounded-xl font-medium shrink-0 shadow-sm">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
        </form>
    );
   
            // ── HERO (no results yet) ──────────────────────────────────────
            if (!shouldShowResultsSection && !artistTracksView && !hasSearched.current) {
                return (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-6 pb-24">
                        <div className="w-full max-w-2xl space-y-10 text-center">

                            {/* Hero text */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-center gap-2.5 mb-2">
                                    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="hsl(var(--primary))">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                    </svg>
                                    <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Spotify Search</span>
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                                    Any track.<br />
                                    <span style={{ color: "hsl(var(--primary))" }}>Isolated.</span>
                                </h1>
                                <p className="text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">
                                    Search Spotify to find any song, then extract its vocals, drums, bass and more.
                                </p>
                            </div>

                            {/* Search bar */}
                            {searchBar}

                        
                        </div>
                    </div>
                );
            }

            // ── RESULTS ────────────────────────────────────────────────────
            return (
                <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                    {/* Compact search bar */}
                    <div className="max-w-2xl">{searchBar}</div>

                    {/* Processing section */}
                    {renderProcessingSection()}

                    {/* Results */}
                    {(shouldShowResultsSection || artistTracksView) && (
                        <section>
                            <div className="flex justify-between items-center pt-2 mb-4 border-b pb-3">
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-xl font-bold tracking-tight">
                                        {artistTracksView
                                            ? <span className="flex items-center gap-2"><span className="text-muted-foreground font-normal">Artist:</span>{artistTracksView.artistName}</span>
                                            : "Search Results"}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {artistTracksView
                                            ? "Top tracks and albums"
                                            : searchQuery ? `Top matches for "${searchQuery}"` : "Discover new music"}
                                    </p>
                                </div>
                            </div>
                            {artistTracksView ? renderArtistDetailView() : renderSearchResults()}
                        </section>
                    )}
                </div>
            );
        })()}
    </div>
);

}
