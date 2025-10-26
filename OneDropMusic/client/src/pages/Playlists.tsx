import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Play, Music } from "lucide-react";

const mockPlaylists = [
  {
    id: '1',
    name: 'Chill Vibes',
    trackCount: 24,
    duration: '1h 45m',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
  },
  {
    id: '2',
    name: 'Workout Mix',
    trackCount: 18,
    duration: '1h 12m',
    cover: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=300&h=300&fit=crop',
  },
  {
    id: '3',
    name: 'Study Session',
    trackCount: 32,
    duration: '2h 30m',
    cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop',
  },
  {
    id: '4',
    name: 'Road Trip',
    trackCount: 45,
    duration: '3h 15m',
    cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop',
  },
  {
    id: '5',
    name: 'Late Night',
    trackCount: 21,
    duration: '1h 38m',
    cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300&h=300&fit=crop',
  },
  {
    id: '6',
    name: 'Party Hits',
    trackCount: 28,
    duration: '2h 5m',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
  },
];

export default function Playlists() {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Playlists</h1>
          <Button data-testid="button-create-playlist">
            <Plus className="w-4 h-4 mr-2" />
            Create Playlist
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockPlaylists.map((playlist) => (
            <Card
              key={playlist.id}
              className="group overflow-hidden hover-elevate cursor-pointer"
              onClick={() => console.log('Opening playlist:', playlist.name)}
              data-testid={`card-playlist-${playlist.id}`}
            >
              <div className="relative aspect-square bg-muted">
                {playlist.cover ? (
                  <img
                    src={playlist.cover}
                    alt={playlist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="icon" className="h-12 w-12" data-testid={`button-play-playlist-${playlist.id}`}>
                    <Play className="w-6 h-6" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-1" data-testid={`text-playlist-name-${playlist.id}`}>
                  {playlist.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {playlist.trackCount} tracks • {playlist.duration}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
