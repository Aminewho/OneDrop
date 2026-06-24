import { Link, useLocation } from "wouter";
import { Music2, Video, Scissors, Library, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMetronome } from '../hooks/useMetronome';
import MetronomeControl from './MetronomeControl';



import { getBranding } from "@/assets/themes/themeManager";
import { LOGOS } from "@/assets/logos/branding";

export default function NavBar() {
  const [location] = useLocation();
      const metronome = useMetronome();

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="#1DB954" className="w-5 h-5">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.491 17.306c-.215.353-.674.464-1.026.249-2.857-1.746-6.453-2.14-10.689-1.173-.404.093-.811-.161-.903-.564-.093-.404.161-.811.564-.903 4.636-1.061 8.599-.611 11.805 1.347.352.215.463.674.249 1.026zm1.465-3.26c-.27.441-.847.581-1.288.312-3.269-2.008-8.253-2.59-12.119-1.416-.496.151-1.022-.128-1.173-.625-.151-.496.128-1.022.625-1.173 4.417-1.34 9.914-.683 13.642 1.609.44.27.581.847.313 1.287h.001zm.126-3.414c-3.921-2.329-10.373-2.543-14.135-1.399-.601.182-1.235-.164-1.417-.765-.182-.601.164-1.235.765-1.417 4.316-1.309 11.442-1.054 15.961 1.63.541.321.716 1.021.395 1.561-.32.541-1.02.716-1.56.395l-.009-.005z"/>
  </svg>
);

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="#FF0000" className="w-5 h-5">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);
 const navItems = [
    // YouTube avec le logo rouge
    { path: "/", label: "Youtube", icon: YoutubeIcon }, 
    { path: "/spotify", label: "Spotify", icon: SpotifyIcon },
    { path: "/separator", label: "Separator", icon: Scissors },
    { path: "/library", label: "Library", icon: Library },
];

const branding = getBranding();

const logoConfig =
    LOGOS[branding?.logo as keyof typeof LOGOS] ??
    LOGOS.bleu;
  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-8">
       <img
    src={logoConfig.src}
    width={logoConfig.width}
    height={logoConfig.height}
    alt={branding?.customer}
/>
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
                   <MetronomeControl metronome={metronome} />

        </div>
      </div>
    </nav>
  );
}
