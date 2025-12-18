import React, { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter'; 
import { toast } from 'react-hot-toast';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Search, Zap, Music, ExternalLink, Loader2, User, TrendingUp, Users, 
    PlayCircle, ArrowLeft, Disc, X, Calendar, Clock
} from 'lucide-react'; 
import { 
    useSpotifyApi, 
    SpotifySearchResults, 
    UserProfile, 
    Artist 
} from '../components/useSpotifyApi'; 

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

// Interface for Album Data based on your JSON
interface AlbumData {
    id: string;
    name: string;
    image: string;
    releaseDate: string;
    totalTracks: number;
    spotifyUrl: string;
}

// Interface for Album Track based on your JSON
interface AlbumTrackData {
    id: string;
    name: string;
    durationMs: number;
    trackNumber: number;
    artists: { name: string }[];
    spotifyUrl: string;
}

type ActiveTab = 'All' | 'Tracks' | 'Artists' | 'Albums';

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

    // --- SEARCH STATES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('All');
    const [searchResults, setSearchResults] = useState<SpotifySearchResults>({
        tracks: [], artists: [], albums: [],
    });

    // --- ARTIST DETAIL STATES ---
    const [artistTracksView, setArtistTracksView] = useState<{ artistName: string, tracks: any[] } | null>(null);
    const [artistAlbums, setArtistAlbums] = useState<AlbumData[]>([]);
    
    // --- ALBUM DETAIL STATES ---
    const [selectedAlbum, setSelectedAlbum] = useState<{ details: AlbumData, tracks: AlbumTrackData[] } | null>(null);
    const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);

    const [, setLocation] = useLocation();
    
    // Destructure new methods from the hook (ensure these are added to useSpotifyApi.ts)
    const { 
        isLoggedIn, 
        searchSpotify, 
        getUserProfile, 
        getTopArtists, 
        getFollowingArtists,
        getArtistTopTracks,
        getArtistAlbums, // Ensure this exists in hook
        getAlbumTracks   // Ensure this exists in hook
    } = useSpotifyApi();


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


    // --- 2. Handle Artist Click (Fetch Top Tracks AND Albums) ---
    const handleArtistClick = async (artistId: string, artistName: string) => {
        if (isSearching) return;
        
        setIsSearching(true);
        setSearchResults({ tracks: [], artists: [], albums: [] });
        setSearchQuery('');
        setSelectedAlbum(null); // Reset album view
        
        try {
            // Run both fetches in parallel for speed
            const [tracksData, albumsData] = await Promise.all([
                getArtistTopTracks(artistId),
                getArtistAlbums(artistId)
            ]);
            
            // Set Top Tracks
            setArtistTracksView({ artistName, tracks: tracksData });

            // Process and Set Albums
            // The JSON structure for albums is nested in `items`
            if (albumsData && albumsData.items) {
                const mappedAlbums: AlbumData[] = albumsData.items.map((album: any) => ({
                    id: album.id,
                    name: album.name,
                    // Use medium image (1) or large (0)
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
            toast.success(`Loaded data for ${artistName}`);

        } catch (error) {
            console.error(error);
            toast.error("Failed to load artist details");
        } finally {
            setIsSearching(false);
        }
    };

    // --- 3. Handle Album Click (Fetch Album Tracks) ---
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

                setSelectedAlbum({
                    details: album,
                    tracks: mappedTracks
                });
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load album tracks");
        } finally {
            setIsLoadingAlbum(false);
        }
    };

    const closeAlbumModal = () => {
        setSelectedAlbum(null);
    };

    // --- 4. Return to Search ---
    const handleReturnToSearch = () => {
        setArtistTracksView(null);
        setArtistAlbums([]);
        setSelectedAlbum(null);
        setSearchQuery(''); 
        setSearchResults({ tracks: [], artists: [], albums: [] }); 
        setActiveTab('All');
    }

    // --- Search Helper ---
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
    
    // Standard Search
    const handleSearch = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!searchQuery.trim() || !isLoggedIn) return;

        setIsSearching(true);
        setArtistTracksView(null);
        setArtistAlbums([]);
        setSelectedAlbum(null);
        setSearchResults({ tracks: [], artists: [], albums: [] });
        setActiveTab('All'); 

        try {
            const results = await searchSpotify(searchQuery); 
            setSearchResults(results);
            const total = results.tracks.length + results.artists.length + results.albums.length;
            if (total === 0) toast("No results found.", { icon: '🔍' });
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, isLoggedIn, searchSpotify]);


    const handleProcessTrack = (trackItem: SearchItem) => {
        console.log("Processing Track:", trackItem);
        toast.success(`Processing track: ${trackItem.name}`);
    };

    // --- RENDERERS ---

    const renderSearchResults = () => {
        let itemsToDisplay: SearchItem[] = [];

        // If generic search results
        if (activeTab === 'All') {
            const tracks = searchResults.tracks.map(t => mapSpotifyItem(t, 'track'));
            const artists = searchResults.artists.map(a => mapSpotifyItem(a, 'artist'));
            const albums = searchResults.albums.map(a => mapSpotifyItem(a, 'album'));
            itemsToDisplay = [...tracks, ...artists, ...albums]; 
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
                            {item.type === 'artist' && (
                                <Button size="sm" variant="outline" onClick={() => handleArtistClick(item.id, item.name)}>
                                    View Artist
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
                {/* 1. Top Tracks Section */}
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
                                        <Button size="sm" onClick={() => handleProcessTrack(item)} className="bg-green-600 hover:bg-green-700 h-8">
                                            Process
                                        </Button>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </section>

                {/* 2. Albums Section (Grid) */}
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
                                    {/* Album Cover */}
                                    <div className="relative aspect-square bg-muted rounded-md overflow-hidden shadow-sm transition-all group-hover:shadow-md group-hover:scale-105">
                                        {album.image ? (
                                            <img src={album.image} alt={album.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-secondary">
                                                <Disc className="w-12 h-12 text-muted-foreground" />
                                            </div>
                                        )}
                                        {/* Overlay Icon */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            {isLoadingAlbum ? (
                                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                                            ) : (
                                                <div className="bg-green-500 rounded-full p-2">
                                                    <PlayCircle className="w-6 h-6 text-white fill-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Album Info */}
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
            
            {/* --- ALBUM MODAL / OVERLAY --- */}
            {selectedAlbum && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-background border-border shadow-2xl">
                        {/* Header */}
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
                            <Button variant="ghost" size="icon" onClick={closeAlbumModal}>
                                <X className="w-6 h-6" />
                            </Button>
                        </div>

                        {/* Tracks List */}
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
                                            <tr key={track.id} className="hover:bg-accent/50 group transition-colors">
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
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        onClick={() => handleProcessTrack({
                                                            id: track.id, type: 'track', name: track.name,
                                                            description: '', image_url: selectedAlbum.details.image,
                                                            external_url: track.spotifyUrl, artists: [], uri: ''
                                                        } as SearchItem)}
                                                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-green-100 text-green-700 hover:bg-green-200"
                                                    >
                                                        <Zap className="w-4 h-4" />
                                                    </Button>
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


            {/* --- CONNECTION STATUS BAR --- */}
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


            {/* --- DEFAULT VIEW (Profile) --- */}
            {renderUserProfile()}

          
            
            {/* --- RESULTS SECTION --- */}
            {(shouldShowResultsSection || artistTracksView) && (
                <section>
                    <div className="flex justify-between items-center pt-4 mb-4 border-b pb-2">
                        <h2 className="text-xl font-medium">
                           {artistTracksView ? `Artist: ${artistTracksView.artistName}` : "Search Results"}
                        </h2>
                        
                        {/* --- BACK BUTTON --- */}
                        {artistTracksView !== null && (
                            <Button 
                                onClick={handleReturnToSearch} 
                                variant="outline" 
                                className="text-sm"
                                disabled={isSearching}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Return to Search
                            </Button>
                        )}
                    </div>
                    
                    {/* --- TAB NAVIGATION (Only for Search) --- */}
                    {!artistTracksView && (
                        <div className="flex flex-wrap gap-2 border-b pb-2 mb-4">
                            {['All', 'Tracks', 'Artists', 'Albums'].map(tab => (
                                <Button 
                                    key={tab}
                                    variant={activeTab === tab ? "default" : "ghost"}
                                    onClick={() => setActiveTab(tab as ActiveTab)}
                                    disabled={isSearching}
                                >
                                    {tab} ({searchResults[tab.toLowerCase() as keyof SpotifySearchResults]?.length || 0})
                                </Button>
                            ))}
                        </div>
                    )}
                    
                    {/* RENDER CONTENT */}
                    {artistTracksView ? renderArtistDetailView() : renderSearchResults()}
                </section>
            )}
        </div>
    );

    // --- USER PROFILE DISPLAY HELPER ---
    function renderUserProfile() {
        if (!isLoggedIn || artistTracksView || searchQuery.length > 0) return null; 

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