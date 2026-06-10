import { useCallback } from 'react';
import { toast } from 'react-hot-toast';

// --- CONFIGURATION ---
// Relative path — works in BOTH environments automatically:
//   Dev  → Vite proxies /spotify → http://localhost:8081/spotify
//   Prod → Spring Boot serves everything on 8081, /spotify resolves directly
const BACKEND_API_BASE_URL = 'http://localhost:8081';


// --- INTERFACES DE TYPES (Simplifiées pour l'exercice) ---
export interface SpotifyImage {
    url: string; 
    height: number; 
    width: number;
}
export interface SpotifySearchResults {
    tracks: any[]; 
    artists: any[];
    albums: any[];
}
export interface UserProfile {
    display_name: string;
    email: string;
    id: string;
    images: SpotifyImage[];
}
export interface Artist {
    id: string;
    name: string;
    images: SpotifyImage[];
    followers: { total: number };
    external_urls: { spotify: string };
}
export interface Album {
    id: string;
    name: string;
    images: SpotifyImage[];
    release_date: string;
    total_tracks: number;
    artists: Artist[];
    external_urls: { spotify: string };
    uri: string;
}
export interface TopArtistsResponse {
    items: Artist[];
}
export interface FollowingArtistsResponse {
    artists: {
        items: Artist[];
    };
}
export interface ArtistAlbumsResponse {
    items: Album[]; // La structure de réponse de Spotify
}
export interface AlbumTracksResponse {
    items: any[]; // Utiliser 'any[]' pour les pistes ou créer une interface Track détaillée
}

/**
 * Custom hook to manage Spotify API interactions, token validity, and automatic refresh.
 */
export const useSpotifyApi = () => {
    const searchSpotify = useCallback(async (query: string): Promise<SpotifySearchResults> => {
        const defaultResults = { tracks: [], artists: [], albums: [] };

        if (!query.trim()) {
            return defaultResults;
        }

        try {
            const url = `${BACKEND_API_BASE_URL}/search/spotify-search?query=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Spotify search failed: ${response.status} - ${errorBody}`);
            }

            const data = await response.json();
            return {
                tracks: data.tracks?.items || [],
                artists: data.artists?.items || [],
                albums: data.albums?.items || [],
            };
        } catch (error) {
            console.error('Spotify search error:', error);
            toast.error('Spotify search failed. See console for details.');
            return defaultResults;
        }
    }, []);

    const getArtistTopTracks = useCallback(async (artistId: string): Promise<any[]> => {
        try {
            const url = `${BACKEND_API_BASE_URL}/search/artists/${encodeURIComponent(artistId)}/top-tracks`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Artist top tracks failed: ${response.status} - ${errorBody}`);
            }

            const data = await response.json();
            return data.tracks || [];
        } catch (error) {
            console.error('Failed to fetch artist top tracks:', error);
            toast.error('Could not load artist tracks.');
            return [];
        }
    }, []);

    const getArtistAlbums = useCallback(async (artistId: string): Promise<ArtistAlbumsResponse> => {
        try {
            const url = `${BACKEND_API_BASE_URL}/search/artists/${encodeURIComponent(artistId)}/albums`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Artist albums failed: ${response.status} - ${errorBody}`);
            }

            return response.json() as Promise<ArtistAlbumsResponse>;
        } catch (error) {
            console.error('Failed to fetch artist albums:', error);
            toast.error('Could not load artist albums.');
            return { items: [] };
        }
    }, []);

    const getAlbumTracks = useCallback(async (albumId: string): Promise<AlbumTracksResponse> => {
        try {
            const url = `${BACKEND_API_BASE_URL}/search/albums/${encodeURIComponent(albumId)}/tracks`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Album tracks failed: ${response.status} - ${errorBody}`);
            }

            return response.json() as Promise<AlbumTracksResponse>;
        } catch (error) {
            console.error('Failed to fetch album tracks:', error);
            toast.error('Could not load album tracks.');
            return { items: [] };
        }
    }, []);

    return {
        searchSpotify,
        getArtistTopTracks,
        getArtistAlbums,
        getAlbumTracks,
    };
};