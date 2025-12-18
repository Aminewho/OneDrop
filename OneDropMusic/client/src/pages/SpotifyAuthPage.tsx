import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, RotateCw, Check, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "react-hot-toast";

// --- CONFIGURATION ---
const CLIENT_ID = "b97d795e6dc744e493aa6d24169d125e"; 
// L'URI de redirection doit correspondre EXACTEMENT à celle enregistrée dans le Dashboard Spotify
const REDIRECT_URI = "http://127.0.0.1:5000/spotify-callback"; 
const SCOPES = "user-read-private user-read-email playlist-read-private user-library-read user-follow-read user-top-read"; 

const AUTH_URL = 'https://accounts.spotify.com/authorize'; 
const TOKEN_URL = 'https://accounts.spotify.com/api/token'; 

// --- FONCTIONS UTILITAIRES PKCE ---
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
    const bytes = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function SpotifyAuthPage() {
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'EXCHANGING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const [, setLocation] = useLocation();

    // --- 1. INITIALISATION DU LOGIN ---
    const handleLogin = useCallback(async () => {
        // Force l'utilisateur à démarrer sur localhost pour que le verifier soit stocké au bon endroit
        if (window.location.hostname === "127.0.0.1") {
            window.location.href = window.location.href.replace("127.0.0.1", "localhost");
            return;
        }

        setStatus('LOADING');
        try {
            const verifier = generateRandomString(128);
            const challenge = await generateCodeChallenge(verifier);

            // Stocké dans le localStorage de LOCALHOST
            localStorage.setItem('spotify_code_verifier', verifier);

            const url = `${AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&code_challenge_method=S256&code_challenge=${challenge}`;
            window.location.href = url;
        } catch (err) {
            setError("Impossible de démarrer l'authentification.");
            setStatus('ERROR');
        }
    }, []);

    // --- 2. ÉCHANGE DU CODE CONTRE LES JETONS ---
    const handleCallback = useCallback(async (authCode: string) => {
        setStatus('EXCHANGING');
        const verifier = localStorage.getItem('spotify_code_verifier');

        if (!verifier) {
            setError("Le 'code verifier' est manquant. Relancez le login depuis localhost.");
            setStatus('ERROR');
            return;
        }

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: REDIRECT_URI, // Doit rester 127.0.0.1 car c'est ce que Spotify attend
            code_verifier: verifier,
        });

        try {
            const response = await fetch(TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params,
            });

            if (!response.ok) throw new Error('Échec de l\'échange de jetons');

            const data = await response.json();

            // Stockage final sur LOCALHOST
            localStorage.setItem('spotify_access_token', data.access_token);
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
            localStorage.setItem('spotify_token_expires_at', String(Date.now() + data.expires_in * 1000));
            
            localStorage.removeItem('spotify_code_verifier');
            setStatus('SUCCESS');
            toast.success("Spotify connecté sur localhost !");
            setTimeout(() => setLocation('/spotify-search'), 1500); 
        } catch (err) {
            setError("Erreur d'échange : " + (err instanceof Error ? err.message : "Inconnue"));
            setStatus('ERROR');
        }
    }, [setLocation]);

    // --- 3. LOGIQUE DE REDIRECTION (LE PONT) ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const errorParam = urlParams.get('error');

        if (errorParam) {
            setError(urlParams.get('error_description') || "Accès refusé.");
            setStatus('ERROR');
            return;
        }

        // ÉTAPE A : Le code arrive sur 127.0.0.1 (via Spotify)
        if (window.location.hostname === "127.0.0.1" && code) {
            console.log("Code reçu sur IP. Bascule vers localhost...");
            const newUrl = window.location.href.replace("127.0.0.1", "localhost");
            window.location.replace(newUrl); // On "saute" vers localhost avec le code
            return;
        }

        // ÉTAPE B : On est maintenant sur localhost avec le code dans l'URL
        if (window.location.hostname === "localhost" && code && status === 'IDLE') {
            handleCallback(code);
            // Nettoyage de l'URL pour la propreté
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [handleCallback, status]);

    const renderContent = () => {
        switch (status) {
            case 'IDLE':
            case 'LOADING':
                return (
                    <>
                        <Zap className="w-12 h-12 text-primary" />
                        <h2 className="text-xl font-semibold mt-4">Connecter Spotify</h2>
                        <p className="text-muted-foreground text-center">Indispensable pour la recherche de morceaux.</p>
                        <Button onClick={handleLogin} disabled={status === 'LOADING'} className="w-full bg-green-500 hover:bg-green-600">
                            {status === 'LOADING' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login with Spotify"}
                        </Button>
                    </>
                );
            case 'EXCHANGING':
                return (
                    <div className="flex flex-col items-center">
                        <RotateCw className="w-12 h-12 text-blue-500 animate-spin" />
                        <h2 className="text-xl font-semibold mt-4">Finalisation...</h2>
                        <p className="text-muted-foreground text-center">Échange sécurisé des jetons sur localhost.</p>
                    </div>
                );
            case 'SUCCESS':
                return (
                    <div className="flex flex-col items-center">
                        <Check className="w-12 h-12 text-green-500" />
                        <h2 className="text-xl font-semibold mt-4">Connecté !</h2>
                        <p className="text-muted-foreground text-center">Redirection vers la recherche...</p>
                    </div>
                );
            case 'ERROR':
                return (
                    <div className="flex flex-col items-center">
                        <AlertTriangle className="w-12 h-12 text-red-500" />
                        <h2 className="text-xl font-semibold mt-4">Erreur</h2>
                        <p className="text-red-400 text-center text-sm">{error}</p>
                        <Button onClick={handleLogin} className="mt-4" variant="outline">Réessayer</Button>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <Card className="w-full max-w-sm p-8 flex flex-col items-center space-y-4 shadow-2xl border-primary/20">
                {renderContent()}
            </Card>
        </div>
    );
}