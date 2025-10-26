import { useState } from "react";
import WaveformTrack from "@/components/WaveformTrack";
import { Button } from "@/components/ui/button";
import { Upload, FileAudio, Download } from "lucide-react";
import { Card } from "@/components/ui/card";

const stems = [
  { label: "Vocals", color: "#60a5fa" },
  { label: "Drums", color: "#a78bfa" },
  { label: "Bass", color: "#34d399" },
  { label: "Other", color: "#fbbf24" },
];

export default function Separator() {
  const [hasTrack, setHasTrack] = useState(false);
  const [stemStates, setStemStates] = useState(
    stems.map(() => ({ isSolo: false, isMuted: false, volume: 75 }))
  );

  const handleFileUpload = () => {
    setHasTrack(true);
    console.log('File uploaded - track separation started');
  };

  const handleSoloToggle = (index: number) => {
    setStemStates(prev => {
      const newStates = [...prev];
      newStates[index].isSolo = !newStates[index].isSolo;
      console.log(`${stems[index].label} solo toggled:`, newStates[index].isSolo);
      return newStates;
    });
  };

  const handleMuteToggle = (index: number) => {
    setStemStates(prev => {
      const newStates = [...prev];
      newStates[index].isMuted = !newStates[index].isMuted;
      console.log(`${stems[index].label} muted:`, newStates[index].isMuted);
      return newStates;
    });
  };

  const handleVolumeChange = (index: number, volume: number) => {
    setStemStates(prev => {
      const newStates = [...prev];
      newStates[index].volume = volume;
      return newStates;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-6">
        {!hasTrack ? (
          <div className="max-w-4xl mx-auto pt-16">
            <Card className="p-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileAudio className="w-10 h-10 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Upload a Track to Separate</h2>
                <p className="text-muted-foreground">
                  Upload your audio file and we'll separate it into individual stems: vocals, drums, bass, and other instruments.
                </p>
              </div>
              <div className="pt-4">
                <Button size="lg" onClick={handleFileUpload} data-testid="button-upload">
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Audio File
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Supported formats: MP3, WAV, FLAC, OGG (Max 50MB)
              </p>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold mb-1" data-testid="text-track-title">
                  George Duke Trio - It's On
                </h1>
                <p className="text-sm text-muted-foreground">Live at Java Jazz Festival</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" data-testid="button-reset">
                  <Upload className="w-4 h-4 mr-2" />
                  New Track
                </Button>
                <Button data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  Export Stems
                </Button>
              </div>
            </div>

            <Card className="p-6">
              <div className="space-y-1">
                {stems.map((stem, index) => (
                  <WaveformTrack
                    key={stem.label}
                    label={stem.label}
                    color={stem.color}
                    isSolo={stemStates[index].isSolo}
                    isMuted={stemStates[index].isMuted}
                    volume={stemStates[index].volume}
                    onSoloToggle={() => handleSoloToggle(index)}
                    onMuteToggle={() => handleMuteToggle(index)}
                    onVolumeChange={(volume) => handleVolumeChange(index, volume)}
                  />
                ))}
              </div>
            </Card>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Sample Rate: 44.1kHz</span>
                <span>•</span>
                <span>Bit Depth: 24-bit</span>
              </div>
              <div>
                Processing Time: 2.3s
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
