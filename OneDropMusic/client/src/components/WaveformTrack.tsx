import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface WaveformTrackProps {
  label: string;
  color: string;
  isSolo?: boolean;
  isMuted?: boolean;
  volume?: number;
  onSoloToggle?: () => void;
  onMuteToggle?: () => void;
  onVolumeChange?: (volume: number) => void;
}

export default function WaveformTrack({
  label,
  color,
  isSolo = false,
  isMuted = false,
  volume = 75,
  onSoloToggle,
  onMuteToggle,
  onVolumeChange,
}: WaveformTrackProps) {
  const [localVolume, setLocalVolume] = useState(volume);

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setLocalVolume(newVolume);
    onVolumeChange?.(newVolume);
  };

  return (
    <div className="flex items-center gap-4 py-2 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 w-32">
        <Button
          size="sm"
          variant={isMuted ? "secondary" : "ghost"}
          className="h-6 w-6 p-0 font-mono text-xs toggle-elevate"
          onClick={onMuteToggle}
          data-testid={`button-mute-${label.toLowerCase()}`}
        >
          M
        </Button>
        <Button
          size="sm"
          variant={isSolo ? "default" : "ghost"}
          className="h-6 w-6 p-0 font-mono text-xs toggle-elevate"
          onClick={onSoloToggle}
          data-testid={`button-solo-${label.toLowerCase()}`}
        >
          S
        </Button>
        <span className="text-sm font-medium text-muted-foreground" data-testid={`text-label-${label.toLowerCase()}`}>
          {label}
        </span>
      </div>

      <div className="flex-1 relative h-16 bg-black/20 rounded-sm overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `linear-gradient(90deg, ${color}00 0%, ${color} 50%, ${color}00 100%)`,
          }}
        >
          <svg className="w-full h-full" preserveAspectRatio="none">
            <path
              d="M0,32 Q25,20 50,32 T100,32 Q125,15 150,32 T200,32 Q225,25 250,32 T300,32 Q325,18 350,32 T400,32 Q425,22 450,32 T500,32 Q525,28 550,32 T600,32 Q625,16 650,32 T700,32 Q725,24 750,32 T800,32 Q825,20 850,32 T900,32 Q925,26 950,32 T1000,32 Q1025,19 1050,32 T1100,32 Q1125,23 1150,32 T1200,32 Q1225,21 1250,32 T1300,32 Q1325,17 1350,32 T1400,32 Q1425,27 1450,32 T1500,32"
              fill={color}
              opacity="0.4"
            />
          </svg>
        </div>
        <div className="absolute top-0 left-1/3 w-0.5 h-full bg-primary" data-testid={`playhead-${label.toLowerCase()}`} />
      </div>

      <div className="flex items-center gap-3 w-48">
        <div className="w-5 h-5 flex items-center justify-center text-muted-foreground">
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </div>
        <Slider
          value={[localVolume]}
          onValueChange={handleVolumeChange}
          max={100}
          step={1}
          className="flex-1"
          data-testid={`slider-volume-${label.toLowerCase()}`}
        />
        <span className="text-xs font-mono text-muted-foreground w-8 text-right" data-testid={`text-volume-${label.toLowerCase()}`}>
          {localVolume}%
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs font-mono">
          1x
        </Button>
      </div>
    </div>
  );
}
