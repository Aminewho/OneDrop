import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

// --- CONFIGURATION ---
const CLIENT_ID = "b97d795e6dc744e493aa6d24169d125e"; 
const REDIRECT_URI = "http://127.0.0.1:5000/spotify-callback"; 

// --- ENDPOINTS ---
// Backend proxy URL (Spring assumed to be on 8080)
const BACKEND_API_BASE_URL = '/spotify'; 
// Use the placeholder for token refresh/exchange, assuming your backend doesn't handle this fully
const TOKEN_URL = 'https://accounts.spotify.com/api/token'; 

export interface SpotifySearchResults {
    tracks: any[]; 
    artists: any[];
    albums: any[];
}
export interface SpotifySearchResults {
    tracks: any[]; 
    artists: any[];
    albums: any[];
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
        if (accessToken && expiryTime && (parseInt(expiryTime) > (Date.now() + 300000))) { return accessToken; }

        return await refreshAccessToken();
    }, [refreshAccessToken]);
   const BACKEND_API_BASE_URL = '/spotify'; 
// We no longer need the Spotify API_BASE_URL for search

// --- 3. SEARCH FUNCTIONALITY (Now Proxied via Spring Backend) ---
const searchSpotify = useCallback(async (query: string): Promise<SpotifySearchResults> => {
        const defaultResults = { tracks: [], artists: [], albums: [] };
        const token = await getValidAccessToken();

        if (!token) {
            toast.error("Not connected to Spotify. Please connect your account.");
            return defaultResults;
        }

        try {
            // Calling your Spring backend endpoint
            console.log("Searching Spotify via backend proxy for query:", query);
            console.log("token:", token);
            const response = await fetch(`${BACKEND_API_BASE_URL}/spotify-search?query=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    // Pass the Spotify Access Token to your backend
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            // Handle token expiry signaled by the backend
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

            // The data is the full search response from Spotify, proxied by Spring
            const data = await response.json();
            
            // Structure the data for the frontend, assuming the backend returns the full Spotify search JSON
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


    return {
        searchSpotify,
        isLoggedIn: !!localStorage.getItem('spotify_refresh_token'),
        isRefreshing,
        getValidAccessToken,
    };
};