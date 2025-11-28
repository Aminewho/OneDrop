import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Volume2, VolumeX, Mic2 } from 'lucide-react';
import { Slider } from "@/components/ui/slider"; // Assurez-vous d'avoir ce composant shadcn ou utilisez un input range
import { cn } from "@/lib/utils";

interface TrackRowProps {
  name: string;
  url: string;
  isPlaying: boolean;
  currentTime: number; // Pour la synchro
  onReady: () => void;
  masterVolume: number; // Si vous voulez un volume général
  isSoloed: boolean;
  isMutedGlobal: boolean; // Si une autre piste est en solo
  onToggleSolo: () => void;
}

export default function TrackRow({ 
  name, 
  url, 
  isPlaying, 
  onReady, 
  isSoloed, 
  isMutedGlobal, 
  onToggleSolo 
}: TrackRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [volume, setVolume] = useState(1.0); // Volume local 0-1
  const [isMuted, setIsMuted] = useState(false);

  // Initialisation de WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#06b6d4', // Couleur cyan comme sur l'image
      progressColor: '#fff',
      cursorColor: '#fff',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 64,
      normalize: true,
      interact: false, // Désactive le clic sur la waveform pour éviter la désynchro accidentelle
      url: url,
    });

    ws.on('ready', () => {
      onReady();
      // Met le volume initial
      ws.setVolume(volume);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [url]);

  // Gestion Play/Pause Global
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    if (isPlaying) {
      ws.play();
    } else {
      ws.pause();
    }
  }, [isPlaying]);

  // Gestion du Mute / Solo Logique
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    // Si cette piste est Muted manuellement OU si une autre piste est en Solo (et pas celle-ci)
    const shouldBeMuted = isMuted || (isMutedGlobal && !isSoloed);
    
    ws.setVolume(shouldBeMuted ? 0 : volume);
    
  }, [isMuted, isMutedGlobal, isSoloed, volume]);

  // Gestion du changement de volume
  const handleVolumeChange = (newVal: number[]) => {
    const vol = newVal[0];
    setVolume(vol);
    if (!isMuted && (!isMutedGlobal || isSoloed)) {
       wavesurferRef.current?.setVolume(vol);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-black/40 p-2 rounded-lg border border-white/10">
      {/* CONTROLES À GAUCHE */}
      <div className="w-48 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between mb-1">
           <span className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
             <Mic2 className="w-4 h-4" /> {name}
           </span>
        </div>

        {/* Boutons Mute / Solo */}
        <div className="flex gap-2">
            <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                    "px-2 py-1 text-xs font-bold rounded border transition-colors flex-1",
                    isMuted 
                        ? "bg-red-500/20 border-red-500 text-red-500" 
                        : "bg-neutral-800 border-neutral-600 text-neutral-400 hover:bg-neutral-700"
                )}
            >
                M
            </button>
            <button
                onClick={onToggleSolo}
                className={cn(
                    "px-2 py-1 text-xs font-bold rounded border transition-colors flex-1",
                    isSoloed 
                        ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" 
                        : "bg-neutral-800 border-neutral-600 text-neutral-400 hover:bg-neutral-700"
                )}
            >
                S
            </button>
        </div>

        {/* Slider Volume et Pan (Pan simulé visuellement pour l'instant) */}
        <div className="flex items-center gap-2 mt-1">
            <Volume2 className="w-3 h-3 text-neutral-500" />
            <Slider 
                defaultValue={[1]} 
                max={1} 
                step={0.01} 
                value={[volume]}
                onValueChange={handleVolumeChange}
                className="flex-1"
            />
        </div>
      </div>

      {/* WAVEFORM À DROITE */}
      <div className="flex-1 h-16 bg-black/20 rounded relative overflow-hidden" ref={containerRef}>
          {/* Le canvas Wavesurfer sera injecté ici */}
      </div>
    </div>
  );
}