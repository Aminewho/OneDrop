import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, RotateCw, Check, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "react-hot-toast";

// --- CONFIGURATION ---
const CLIENT_ID = "b97d795e6dc744e493aa6d24169d125e"; 
// The URI registered in your Spotify Developer Dashboard. Must match the app's running port.
const REDIRECT_URI = "http://127.0.0.1:5000/spotify-callback"; 
const SCOPES = "user-read-private user-read-email"; 

// --- SPOTIFY ENDPOINTS ---
const AUTH_URL = 'https://accounts.spotify.com/authorize'; // Correct Authorization endpoint
const TOKEN_URL = 'https://accounts.spotify.com/api/token'; // Correct Token endpoint

// --- UTILITY FUNCTIONS ---

const generateRandomString = (length: number) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

async function generateCodeChallenge(codeVerifier: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    
    // Base64Url encode the hash
    const bytes = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// --------------------------------------------------------------------------

export default function SpotifyAuthPage() {
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'EXCHANGING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useLocation();

    // --- FUNCTION TO INITIATE LOGIN ---
    const handleLogin = useCallback(async () => {
        setStatus('LOADING');
        setError(null);
        
        try {
            const verifier = generateRandomString(128);
            const challenge = await generateCodeChallenge(verifier);

            // 1. Save the verifier for later exchange
            localStorage.setItem('spotify_code_verifier', verifier);

            // 2. Build the authorization URL using the correct AUTH_URL
            const url = AUTH_URL + 
                `?client_id=${CLIENT_ID}&` +
                `response_type=code&` +
                `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
                `scope=${encodeURIComponent(SCOPES)}&` +
                `code_challenge_method=S256&` +
                `code_challenge=${challenge}`;

            // 3. Redirect the user to Spotify
            window.location.href = url;

        } catch (err) {
            console.error("Login initiation failed:", err);
            setError("Could not start Spotify login flow.");
            setStatus('ERROR');
            toast.error("Login initiation failed.");
        }
    }, []);

    // --- FUNCTION TO HANDLE CALLBACK AND EXCHANGE CODE ---
    const handleCallback = useCallback(async (authCode: string) => {
        setStatus('EXCHANGING');
        setError(null);
        const verifier = localStorage.getItem('spotify_code_verifier');

        if (!verifier) {
            setError("Authentication flow interrupted. Please try again.");
            setStatus('ERROR');
            return;
        }

        // 1. Prepare token exchange data
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        });

        // 2. Request Access and Refresh Tokens using the correct TOKEN_URL
        try {
            const response = await fetch(TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params,
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Spotify Token Exchange Error Details:", errorData);
                throw new Error(errorData.error_description || errorData.error || 'Token exchange failed.');
            }

            const data = await response.json();

            // 3. Store tokens securely
            localStorage.setItem('spotify_access_token', data.access_token);
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
            localStorage.setItem('spotify_token_expires_at', String(Date.now() + data.expires_in * 1000));
            
            // 4. Clean up and complete
            localStorage.removeItem('spotify_code_verifier');
            setStatus('SUCCESS');
            toast.success("Spotify connected successfully!");
            
            // Redirect user to the search page after successful login
            setTimeout(() => setLocation('/spotify-search'), 1500); 

        } catch (err) {
            console.error("Token exchange error:", err);
            setError(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`);
            setStatus('ERROR');
            toast.error("Spotify authentication failed.");
        }
    }, [setLocation]);

    // --- EFFECT TO HANDLE THE REDIRECT/CALLBACK (Stabilized) ---
    useEffect(() => {
        const url = window.location.href;
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const code = urlParams.get('code');
        const errorParam = urlParams.get('error');

        if (status !== 'IDLE') {
            return;
        }

        // A) Handle Error Redirect
        if (errorParam) {
            setError(urlParams.get('error_description') || 'Spotify authentication was denied or failed.');
            setStatus('ERROR');
            toast.error("Spotify login denied.");
            window.history.replaceState(null, '', '/spotify-auth'); 
            return;
        }

        // B) Handle Code Redirect
        if (code) {
            // Remove the code from the URL before calling handleCallback
            window.history.replaceState(null, '', '/spotify-auth'); 
            
            // Now, proceed with the token exchange
            handleCallback(code);
        }
        
    }, [handleCallback, status]);

    // --- RENDER LOGIC (unchanged) ---

    const renderContent = () => {
        switch (status) {
            case 'IDLE':
            case 'LOADING':
                return (
                    <>
                        <Zap className="w-12 h-12 text-primary" />
                        <h2 className="text-xl font-semibold mt-4">Connect Your Spotify Account</h2>
                        <p className="text-muted-foreground text-center">
                            Access real-time song search directly from Spotify.
                        </p>
                        <Button 
                            onClick={handleLogin} 
                            disabled={status === 'LOADING'}
                            className="w-full bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-900/20"
                        >
                            {status === 'LOADING' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {status === 'LOADING' ? "Redirecting..." : "Login with Spotify"}
                        </Button>
                    </>
                );

            case 'EXCHANGING':
                return (
                    <div className="flex flex-col items-center">
                        <RotateCw className="w-12 h-12 text-blue-500 animate-spin" />
                        <h2 className="text-xl font-semibold mt-4">Finalizing Connection...</h2>
                        <p className="text-muted-foreground text-center">
                            Exchanging authorization code for secure tokens.
                        </p>
                    </div>
                );

            case 'SUCCESS':
                return (
                    <div className="flex flex-col items-center">
                        <Check className="w-12 h-12 text-green-500" />
                        <h2 className="text-xl font-semibold mt-4">Connection Successful!</h2>
                        <p className="text-muted-foreground text-center">
                            You can now search Spotify for songs to process.
                        </p>
                        <Button onClick={() => setLocation('/spotify-search')} className="mt-4">
                            Go to Search
                        </Button>
                    </div>
                );

            case 'ERROR':
                return (
                    <div className="flex flex-col items-center">
                        <AlertTriangle className="w-12 h-12 text-red-500" />
                        <h2 className="text-xl font-semibold mt-4">Connection Error</h2>
                        <p className="text-red-400 text-center">{error}</p>
                        <Button onClick={handleLogin} className="mt-4" variant="outline">
                            Try Again
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <Card className="w-full max-w-sm p-8 flex flex-col items-center space-y-4 shadow-2xl">
                {renderContent()}
            </Card>
        </div>
    );
}