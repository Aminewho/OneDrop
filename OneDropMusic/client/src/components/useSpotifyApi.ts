import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

// --- CONFIGURATION ---
const CLIENT_ID = "b97d795e6dc744e493aa6d24169d125e"; 
const REDIRECT_URI = "http://127.0.0.1:5000/spotify-callback"; 

// --- ENDPOINTS ---
// Backend proxy URL (Spring assumed to be on 8080, proxied via Vite/CORS setup)
const BACKEND_API_BASE_URL = '/spotify'; 
// Use the placeholder for token refresh/exchange (Spotify standard token endpoint)
const TOKEN_URL = 'https://accounts.spotify.com/api/token'; 


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
    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- 1. TOKEN REFRESH LOGIC (Uses TOKEN_URL) ---
    const refreshAccessToken = useCallback(async (): Promise<string | null> => {
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (!refreshToken) { return null; }

        if (isRefreshing || localStorage.getItem('is_token_refreshing')) {
             return new Promise((resolve) => {
                 const checkInterval = setInterval(() => {
                     if (!localStorage.getItem('is_token_refreshing')) {
                         clearInterval(checkInterval);
                         resolve(localStorage.getItem('spotify_access_token'));
                     }
                 }, 100);
             });
        }
        
        setIsRefreshing(true);
        localStorage.setItem('is_token_refreshing', 'true');

        try {
            const params = new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            });

            // Fetches from the actual TOKEN_URL
            const response = await fetch(TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params,
            });

            if (!response.ok) {
                localStorage.clear(); 
                toast.error("Spotify session expired. Please log in again.");
                return null;
            }

            const data = await response.json();

            localStorage.setItem('spotify_access_token', data.access_token);
            if (data.refresh_token) {
                localStorage.setItem('spotify_refresh_token', data.refresh_token);
            }
            localStorage.setItem('spotify_token_expires_at', String(Date.now() + data.expires_in * 1000));
            
            return data.access_token;

        } catch (error) {
            console.error("Token refresh failed:", error);
            toast.error("Failed to refresh Spotify session.");
            return null;
        } finally {
            setIsRefreshing(false);
            localStorage.removeItem('is_token_refreshing');
        }
    }, [isRefreshing]);

    // --- 2. GET VALID TOKEN ---
    const getValidAccessToken = useCallback(async (): Promise<string | null> => {
        const accessToken = localStorage.getItem('spotify_access_token');
        const expiryTime = localStorage.getItem('spotify_token_expires_at');
        const refreshToken = localStorage.getItem('spotify_refresh_token');

        if (!refreshToken) { return null; }
        // Vérifie si le token expire dans les 5 minutes (300 000 ms)
        if (accessToken && expiryTime && (parseInt(expiryTime) > (Date.now() + 300000))) { return accessToken; }

        return await refreshAccessToken();
    }, [refreshAccessToken]);
    
    // --- 3. SEARCH FUNCTIONALITY (Proxied via Spring Backend) ---
    const searchSpotify = useCallback(async (query: string): Promise<SpotifySearchResults> => {
        const defaultResults = { tracks: [], artists: [], albums: [] };
        const token = await getValidAccessToken();

        if (!token) {
            toast.error("Not connected to Spotify. Please connect your account.");
            return defaultResults;
        }

        try {
            // Endpoint Spring: /spotify-search
            const response = await fetch(`${BACKEND_API_BASE_URL}/spotify-search?query=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 401) {
                 const newToken = await refreshAccessToken();
                 if(newToken) {
                     return searchSpotify(query);
                 }
            }

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Backend Proxy error: ${response.status} - ${errorBody}`);
            }

            const data = await response.json();
            
            return {
                tracks: data.tracks?.items || [],
                artists: data.artists?.items || [],
                albums: data.albums?.items || [],
            };

        } catch (error) {
            console.error("Proxied Spotify Search failed:", error);
            toast.error("Proxied search failed. Check console for details.");
            return defaultResults;
        }
    }, [getValidAccessToken, refreshAccessToken]);
    
    // --- 4. USER PROFILE (Proxied via Spring Backend) ---
    const getUserProfile = useCallback(async (): Promise<UserProfile> => {
        const accessToken = await getValidAccessToken(); 
        if (!accessToken) {
            toast.error("Not connected to Spotify. Please connect your account.");
            throw new Error("No valid access token.");
        }

        try {
            // Endpoint Spring: /profile
            const response = await fetch(`${BACKEND_API_BASE_URL}/profile`, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            });

            if (response.status === 401) { 
                const newToken = await refreshAccessToken();
                if(newToken) { return getUserProfile(); }
            }

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`Profile API error: ${response.status} - ${errorBody.error?.message || response.statusText}`);
            }
            return response.json() as Promise<UserProfile>;
        } catch (e) {
            console.error("Failed to fetch user profile:", e);
            throw e;
        }
    }, [getValidAccessToken, refreshAccessToken]); 

    // --- 5. TOP ARTISTS (Proxied via Spring Backend) ---
    const getTopArtists = useCallback(async (): Promise<TopArtistsResponse> => { 
        const accessToken = await getValidAccessToken();
        if (!accessToken) throw new Error("No access token available.");

        // Endpoint Spring: /topArtists
        const response = await fetch(`${BACKEND_API_BASE_URL}/topArtists`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if(newToken) { return getTopArtists(); }
        }
        
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Top Artists API error: ${response.status} - ${errorBody.error?.message || response.statusText}`);
        }
        return response.json() as Promise<TopArtistsResponse>;
    }, [getValidAccessToken, refreshAccessToken]);

    // --- 6. FOLLOWING ARTISTS (Proxied via Spring Backend) ---
    const getFollowingArtists = useCallback(async (): Promise<FollowingArtistsResponse> => { 
        const accessToken = await getValidAccessToken();
        if (!accessToken) throw new Error("No access token available.");

        // Endpoint Spring: /followingArtists
        const response = await fetch(`${BACKEND_API_BASE_URL}/followingArtists`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if(newToken) { return getFollowingArtists(); }
        }
        
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Following Artists API error: ${response.status} - ${errorBody.error?.message || response.statusText}`);
        }
        return response.json() as Promise<FollowingArtistsResponse>;
    }, [getValidAccessToken, refreshAccessToken]);

    // --- 7. ARTIST TOP TRACKS (Proxied via Spring Backend) ---
    const getArtistTopTracks = useCallback(async (artistId: string): Promise<any[]> => {
        const accessToken = await getValidAccessToken();
        if (!accessToken) throw new Error("No access token available.");

        try {
            // Endpoint Spring: /artistsTopTracks (ID dans les headers)
            const response = await fetch(`${BACKEND_API_BASE_URL}/artistsTopTracks`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'id': artistId // Pass the Artist ID in the custom header
                }
            });

            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) return getArtistTopTracks(artistId);
            }

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Artist Tracks API error: ${response.status} - ${errorBody}`);
            }

            const data = await response.json();
            return data.tracks || []; // Assumes backend returns { "tracks": [...] }

        } catch (error) {
            console.error("Failed to fetch artist top tracks:", error);
            toast.error("Could not load artist tracks.");
            return [];
        }
    }, [getValidAccessToken, refreshAccessToken]);
    
    // --- 8. ARTIST ALBUMS (NOUVEAU - Proxied via Spring Backend) ---
   const getArtistAlbums = useCallback(async (artistId: string): Promise<ArtistAlbumsResponse> => {
        const accessToken = await getValidAccessToken();
        if (!accessToken) throw new Error("No access token available.");

        try {
            // ✅ Endpoint Spring mis à jour : /artists/{id}/albums
            const response = await fetch(`${BACKEND_API_BASE_URL}/artists/${artistId}/albums`, {
                method: 'GET',
                headers: { 
                    // Seul l'Authorization et Content-Type sont nécessaires ici
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    // ❌ L'ID N'EST PLUS DANS LE HEADER 
                }
            });

            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) return getArtistAlbums(artistId);
            }

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Artist Albums API error: ${response.status} - ${errorBody}`);
            }

            return response.json() as Promise<ArtistAlbumsResponse>;

        } catch (error) {
            console.error("Failed to fetch artist albums:", error);
            toast.error("Could not load artist albums.");
            throw error;
        }
    }, [getValidAccessToken, refreshAccessToken]);

    // --- 9. ALBUM TRACKS (Mise à jour pour utiliser l'ID dans l'URL) ---
    const getAlbumTracks = useCallback(async (albumId: string): Promise<AlbumTracksResponse> => {
        const accessToken = await getValidAccessToken();
        if (!accessToken) throw new Error("No access token available.");

        try {
            // ✅ Endpoint Spring mis à jour : /albums/{id}/tracks
            const response = await fetch(`${BACKEND_API_BASE_URL}/albums/${albumId}/tracks`, {
                method: 'GET',
                headers: { 
                    // Seul l'Authorization et Content-Type sont nécessaires ici
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    // ❌ L'ID N'EST PLUS DANS LE HEADER 
                }
            });

            if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) return getAlbumTracks(albumId);
            }

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Album Tracks API error: ${response.status} - ${errorBody}`);
            }

            return response.json() as Promise<AlbumTracksResponse>; // Assumes full Spotify track response

        } catch (error) {
            console.error("Failed to fetch album tracks:", error);
            toast.error("Could not load album tracks.");
            throw error;
        }
    }, [getValidAccessToken, refreshAccessToken]);


    // --- RETURN OBJECT ---
    return {
        searchSpotify,
        isLoggedIn: !!localStorage.getItem('spotify_refresh_token'),
        isRefreshing,
        getValidAccessToken,
        getUserProfile, 
        getTopArtists, 
        getFollowingArtists,
        getArtistTopTracks,
        getArtistAlbums, // NOUVEAU
        getAlbumTracks,  // NOUVEAU
    };
};