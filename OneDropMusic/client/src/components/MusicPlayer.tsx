import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, Mic2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface MusicPlayerProps {
  trackTitle?: string;
  trackArtist?: string;
  thumbnail?: string;
  duration?: number;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export default function MusicPlayer({
  trackTitle = "No track playing",
  trackArtist = "",
  thumbnail,
  duration = 360,
  onPlayPause,
  onNext,
  onPrevious,
}: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(125);
  const [volume, setVolume] = useState(75);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    onPlayPause?.();
    console.log('Play/Pause toggled:', !isPlaying);
  };

  return (
    <div className="border-t border-border bg-card">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={trackTitle}
                className="w-14 h-14 rounded-md object-cover"
                data-testid="img-player-thumbnail"
              />
            ) : (
              <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center">
                <Music className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" data-testid="text-player-title">
                {trackTitle}
              </p>
              {trackArtist && (
                <p className="text-xs text-muted-foreground truncate" data-testid="text-player-artist">
                  {trackArtist}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 max-w-2xl">
            <div className="flex items-center justify-center gap-4 mb-2">
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 ${isShuffled ? 'text-primary' : ''}`}
                onClick={() => {
                  setIsShuffled(!isShuffled);
                  console.log('Shuffle toggled:', !isShuffled);
                }}
                data-testid="button-shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  onPrevious?.();
                  console.log('Previous track');
                }}
                data-testid="button-previous"
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                className="h-10 w-10"
                onClick={handlePlayPause}
                data-testid="button-play-pause"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  onNext?.();
                  console.log('Next track');
                }}
                data-testid="button-next"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 ${repeatMode ? 'text-primary' : ''}`}
                onClick={() => {
                  setRepeatMode(!repeatMode);
                  console.log('Repeat toggled:', !repeatMode);
                }}
                data-testid="button-repeat"
              >
                <Repeat className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground w-10 text-right" data-testid="text-current-time">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                onValueChange={(values) => {
                  setCurrentTime(values[0]);
                  console.log('Seek to:', values[0]);
                }}
                max={duration}
                step={1}
                className="flex-1"
                data-testid="slider-progress"
              />
              <span className="text-xs font-mono text-muted-foreground w-10" data-testid="text-duration">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end">
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-lyrics">
                <Mic2 className="w-4 h-4" />
              </Button>
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <Slider
                value={[volume]}
                onValueChange={(values) => {
                  setVolume(values[0]);
                  console.log('Volume:', values[0]);
                }}
                max={100}
                step={1}
                className="w-24"
                data-testid="slider-volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
