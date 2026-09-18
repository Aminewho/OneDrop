import React, { useEffect, useState } from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyBranding, BrandingConfig } from "@/assets/themes/themeManager";
import NavBar from "@/components/NavBar";
import MusicPlayer from "@/components/MusicPlayer";
import Videos from "@/pages/Videos";
import Separator from "@/pages/Separator";
import Library from "@/pages/Library";
import SpotifySearchPage from './pages/SpotifySearchPage';
function Router() {
  return (
    
    <Switch>
      {/* Utilisation de wouter. La route sans "exact" agit comme "exact" si elle est placée en premier 
          et qu'elle est la plus courte. */}
          
      <Route path="/" component={Videos} />
      <Route path="/separator" component={Separator} />
      <Route path="/library" component={Library} />
      <Route path="/spotify" component={SpotifySearchPage}/>

    </Switch>
  );
}

function App() {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await fetch("http://localhost:8081/api/config");
        if (!response.ok) throw new Error("Unable to load config");
        const config = await response.json();
        applyBranding(config);
        setBranding(config);
      } catch (error) {
        console.error("Branding loading failed:", error);
        const fallback = { theme: "classic", logo: "classic", customer: "OneDrop" };
        applyBranding(fallback);
        setBranding(fallback);
      }
    };
    loadBranding();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <div className="flex h-screen bg-background overflow-hidden">
            <NavBar branding={branding} />
            <main className="flex-1 overflow-y-auto">
              <Router />
            </main>
          </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;