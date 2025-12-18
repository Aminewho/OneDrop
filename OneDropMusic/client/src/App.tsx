import React from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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