import { Link, useLocation } from "wouter";
import { Music2, Video, Scissors, Library, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NavBar() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Videos", icon: Video },
    { path: "/separator", label: "Separator", icon: Scissors },
    { path: "/library", label: "Library", icon: Library },
    { path: "/playlists", label: "Playlists", icon: ListMusic },
    {   path: "/spotify-callback", label: "Spotify", icon: Music2 },
    {    path: "/spotify-search", label: "Spotify", icon: Music2 },    
  ];

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 hover-elevate px-3 py-2 -ml-3 rounded-md" data-testid="link-logo">
            <Music2 className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold">One Drop</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path} data-testid={`link-${item.label.toLowerCase()}`}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" data-testid="button-profile">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
              U
            </div>
          </Button>
        </div>
      </div>
    </nav>
  );
}
