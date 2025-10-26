import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Play, MoreVertical, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const mockLibrary = [
  {
    id: '1',
    title: 'Sunset Vibes',
    artist: 'Chill Beats Collection',
    duration: 245,
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop',
    addedAt: '2 days ago',
  },
  {
    id: '2',
    title: 'Night Drive',
    artist: 'Lo-Fi Sessions',
    duration: 198,
    thumbnail: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=80&h=80&fit=crop',
    addedAt: '1 week ago',
  },
  {
    id: '3',
    title: 'Morning Coffee',
    artist: 'Acoustic Dreams',
    duration: 312,
    thumbnail: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=80&h=80&fit=crop',
    addedAt: '3 days ago',
  },
  {
    id: '4',
    title: 'Deep Focus',
    artist: 'Study Music Mix',
    duration: 423,
    thumbnail: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=80&fit=crop',
    addedAt: '2 weeks ago',
  },
  {
    id: '5',
    title: 'Urban Groove',
    artist: 'Hip Hop Instrumentals',
    duration: 267,
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop',
    addedAt: '5 days ago',
  },
];

export default function Library() {
  const [searchQuery, setSearchQuery] = useState("");

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Your Library</h1>
          <Button data-testid="button-add-music">
            <Music className="w-4 h-4 mr-2" />
            Add Music
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-library"
          />
        </div>

        <div className="space-y-2">
          {mockLibrary.map((track, index) => (
            <Card key={track.id} className="hover-elevate">
              <div className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate" data-testid={`text-track-title-${track.id}`}>
                    {track.title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate" data-testid={`text-track-artist-${track.id}`}>
                    {track.artist}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(track.duration)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{track.addedAt}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => console.log('Playing:', track.title)}
                    data-testid={`button-play-${track.id}`}
                  >
                    <Play className="w-5 h-5" />
                  </Button>
                  <Button size="icon" variant="ghost" data-testid={`button-more-${track.id}`}>
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
