import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NavBar from "@/components/NavBar";
import MusicPlayer from "@/components/MusicPlayer";
import Videos from "@/pages/Videos";
import Separator from "@/pages/Separator";
import Library from "@/pages/Library";
import Playlists from "@/pages/Playlists";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Videos} />
      <Route path="/separator" component={Separator} />
      <Route path="/library" component={Library} />
      <Route path="/playlists" component={Playlists} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col h-screen bg-background">
          <NavBar />
          <main className="flex-1 overflow-y-auto">
            <Router />
          </main>
          <MusicPlayer
            trackTitle="George Duke Trio - It's On"
            trackArtist="Live at Java Jazz Festival"
            thumbnail="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop"
            duration={360}
          />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
