import React from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// Import du VideoStateProvider pour persister l'état
// NOTE: L'extension de ce fichier pourrait être .jsx ou .tsx selon votre configuration
import { VideoStateProvider } from "./context/VideoStateContext"; 

// Import des composants et pages
import NavBar from "@/components/NavBar";
import MusicPlayer from "@/components/MusicPlayer";
import Videos from "@/pages/Videos";
import Separator from "@/pages/Separator";
import Library from "@/pages/Library";
import Playlists from "@/pages/Playlists";
import SpotifyAuthPage from "@/pages/SpotifyAuthPage";
import SpotifySearchPage from './pages/SpotifySearchPage';  
function Router() {
  return (
    
    <Switch>
      {/* Utilisation de wouter. La route sans "exact" agit comme "exact" si elle est placée en premier 
          et qu'elle est la plus courte. */}
          
      <Route path="/" component={Videos} />
      <Route path="/separator" component={Separator} />
      <Route path="/library" component={Library} />
      <Route path="/playlists" component={Playlists} />^
      <Route path="/spotify-callback" component={SpotifyAuthPage}/>
       <Route path="/spotify-search" component={SpotifySearchPage}/>

    </Switch>
  );
}

function App() {
 useEffect(() => {
    // 1. On vérifie si on est sur l'IP 127.0.0.1
    const isUsingIP = window.location.hostname === "127.0.0.1";
    
    // 2. On vérifie si on n'est PAS sur la page de callback de Spotify
    // On utilise window.location.pathname (natif JS) au lieu du hook location.pathname
    const isNotCallbackPage = !window.location.pathname.includes('/callback');

    if (isUsingIP && isNotCallbackPage) {
      console.log("Spotify Auth terminée. Bascule sur localhost pour YouTube...");
      
      // On remplace l'IP par localhost dans l'URL actuelle
      const newUrl = window.location.href.replace("127.0.0.1", "localhost");
      
      // Redirection immédiate
      window.location.replace(newUrl);
    }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Le VideoStateProvider enveloppe tout le contenu pour conserver l'état des vidéos (recherche, statut des tâches). */}
          <div className="flex flex-col h-screen bg-background">
            <NavBar />
            <main className="flex-1 overflow-y-auto">
              {/* Le composant Router gère l'affichage des pages */}
              <Router />
            </main>
          
          </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;