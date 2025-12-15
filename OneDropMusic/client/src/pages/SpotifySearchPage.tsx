import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter'; 
import { toast } from 'react-hot-toast';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Zap, Music, ExternalLink, Loader2 } from 'lucide-react';
import { useSpotifyApi, SpotifySearchResults } from '../components/useSpotifyApi'; // Adjust path as needed

// Helper function to format track duration (ms to min:sec)
const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// New interface for generic search result items (for mapping)
interface SearchItem {
    id: string;
    type: 'track' | 'artist' | 'album';
    name: string;
    description: string; 
    image_url: string;
    external_url: string;
    artists: { id: string; name: string }[]; // Added artists for track processing
    uri: string; // Added URI for track processing
}

type ActiveTab = 'All' | 'Tracks' | 'Artists' | 'Albums';

export default function SpotifySearchPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('All');
    const [searchResults, setSearchResults] = useState<SpotifySearchResults>({
        tracks: [],
        artists: [],
        albums: [],
    });

    const [, setLocation] = useLocation();
    const { isLoggedIn, searchSpotify } = useSpotifyApi();

    // Helper function to map Spotify API object to a generic display item
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
                    artists: [], uri: '', // Not applicable
                };
            case 'album':
                return {
                    id: item.id,
                    type: 'album',
                    name: item.name,
                    description: `Album • ${item.artists.map((a: any) => a.name).join(', ')} • ${item.release_date.split('-')[0]}`,
                    image_url: item.images?.[0]?.url || '',
                    external_url: item.external_urls.spotify,
                    artists: [], uri: '', // Not applicable
                };
        }
    };
    
    const handleSearch = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!searchQuery.trim() || !isLoggedIn) return;

        setIsSearching(true);
        setSearchResults({ tracks: [], artists: [], albums: [] });
        setActiveTab('All'); // Reset tab on new search

        try {
            const results = await searchSpotify(searchQuery); 
            setSearchResults(results);

            const totalResults = results.tracks.length + results.artists.length + results.albums.length;
            if (totalResults === 0) {
                toast("No results found for that query.", { icon: '🔍' });
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, isLoggedIn, searchSpotify]);


    const handleProcessTrack = (trackItem: SearchItem) => {
        // Implement your track processing logic here (e.g., sending data to a backend)
        console.log("Processing Track:", trackItem);
        toast.success(`Processing track: ${trackItem.name}`);
        // Example: setLocation(`/processing/${trackItem.id}`);
    };

    const renderTrackList = () => {
        let itemsToDisplay: SearchItem[] = [];

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
                    Searching Spotify...
                </div>
            );
        }
        
        if (searchQuery.length > 0 && itemsToDisplay.length === 0) {
            return <div className="text-center p-8 text-muted-foreground">No {activeTab.toLowerCase()} results found.</div>;
        }


        return (
            <div className="space-y-2">
                {itemsToDisplay.map((item) => (
                    <Card key={`${item.type}-${item.id}`} className="hover-elevate transition-all duration-200 hover:bg-accent/5">
                        <div className="flex items-center gap-4 p-3 sm:p-4">
                            {/* Thumbnail */}
                            <div className={`relative w-12 h-12 bg-muted flex items-center justify-center overflow-hidden 
                                    ${item.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}>
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Music className="w-6 h-6 text-muted-foreground" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Display Type Tag and Title */}
                                <span className="text-xs font-bold uppercase text-primary/70 mr-2">{item.type}</span>
                                <h3 className="font-medium truncate" title={item.name}>
                                    {item.name}
                                </h3>
                                <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                                {item.type === 'track' && (
                                    <Button
                                        size="sm"
                                        onClick={() => handleProcessTrack(item)}
                                        className="bg-green-500 hover:bg-green-600 text-white"
                                    >
                                        Process
                                    </Button>
                                )}
                                
                                <a href={item.external_url} target="_blank" rel="noopener noreferrer">
                                    <Button size="icon" variant="ghost" className="hover:text-primary" title="Open in Spotify">
                                        <ExternalLink className="w-5 h-5" />
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        );
    }

    // Calculate total results for tab counters
    const totalResults = searchResults.tracks.length + searchResults.artists.length + searchResults.albums.length;
    
    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <header className="flex justify-between items-center py-6">
                <h1 className="text-3xl font-bold">Spotify Search</h1>
                <Button onClick={() => setLocation('/library')} variant="outline">View Library</Button>
            </header>

            {/* --- CONNECTION STATUS BAR --- */}
            {!isLoggedIn ? (
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
            ) : null}
            {/* --- END CONNECTION STATUS BAR --- */}
            
            {/* --- SEARCH FORM --- */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <Input
                    type="search"
                    placeholder={isLoggedIn ? "Search for tracks, artists, or albums..." : "Connect Spotify to enable search..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={!isLoggedIn || isSearching}
                    className="flex-1"
                />
                <Button type="submit" disabled={!isLoggedIn || isSearching} className="w-32">
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Search
                </Button>
            </form>
            
            {/* --- RESULTS SECTION --- */}
            {totalResults > 0 && (
                <section>
                    <h2 className="text-xl font-medium pt-4">Search Results</h2>
                    
                    {/* --- TAB NAVIGATION --- */}
                    <div className="flex flex-wrap gap-2 border-b pb-2 mb-4">
                        {['All', 'Tracks', 'Artists', 'Albums'].map(tab => (
                            <Button 
                                key={tab}
                                variant={activeTab === tab ? "default" : "ghost"}
                                onClick={() => setActiveTab(tab as ActiveTab)}
                                className={activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
                                disabled={isSearching}
                            >
                                {tab} ({searchResults[tab.toLowerCase() as keyof SpotifySearchResults]?.length || 0})
                            </Button>
                        ))}
                    </div>
                    {/* --- END TAB NAVIGATION --- */}
                    
                    {renderTrackList()}
                </section>
            )}
            {/* --- END RESULTS SECTION --- */}
        </div>
    );
}