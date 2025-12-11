import React from 'react';
import { useVideoState, VideoStateContextType } from '@/context/VideoStateContext';
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize2, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter'; // Pour vérifier la route

// Fonction utilitaire pour formater le temps en MM:SS
const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

const MusicPlayer: React.FC = () => {
  // Le hook useVideoState retourne maintenant l'interface VideoStateContextType mise à jour.
  // Nous pouvons déstructurer directement sans transtypage temporaire.
  const { 
    isPlaying, 
    currentTime, 
    duration, 
    playerControls, 
    videoInfo 
  } = useVideoState();
  
  const [location] = useLocation();

  // Le lecteur global n'est pertinent que sur la page du séparateur pour l'instant
  // S'il n'y a pas d'info vidéo (on n'est pas sur la page /separator ou rien n'est chargé), on cache le player
  if (location !== '/separator' || !videoInfo.title) {
    return null;
  }
  
  // Utilise les contrôles fournis par le contexte (qui sont définis dans Separator.tsx)
  const handlePlayPause = () => {
    if (playerControls.togglePlayPause) {
      playerControls.togglePlayPause();
    }
  };

  const handleSeek = (value: number[]) => {
    // Le composant Slider renvoie un tableau de valeurs (même pour un seul point)
    if (playerControls.seek) {
      playerControls.seek(value[0]);
    }
  };

  // État de la barre de progression pour le Slider
  // Note: La valeur du Slider est le currentTime, max est la duration
  const progressValue = currentTime; 
  
  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm z-50 shadow-2xl transition-all duration-300 ease-in-out">
      <div className="flex items-center justify-between h-20 px-6 space-x-4">
        
        {/* Section de l'information sur la piste */}
        <div className="flex items-center space-x-4 w-1/4">
          <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary/80">
            <Volume2 className="w-6 h-6" />
          </div>
          <div className="truncate">
            <p className="text-sm font-semibold truncate text-foreground/90">{videoInfo.title || 'Aucune piste en cours'}</p>
            <p className="text-xs text-muted-foreground truncate">{videoInfo.artist || 'One Drop'}</p>
          </div>
        </div>

        {/* Section des contrôles de lecture centraux */}
        <div className="flex flex-col items-center justify-center w-2/4">
          <div className="flex items-center space-x-6 mb-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground/80">
              <Repeat className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              variant="default"
              size="lg"
              className={cn(
                "rounded-full w-12 h-12 transition-transform duration-150",
                isPlaying ? 'bg-primary hover:bg-primary/90' : 'bg-primary/80 hover:bg-primary'
              )}
              onClick={handlePlayPause}
              disabled={!playerControls.togglePlayPause} // Désactive si les contrôles ne sont pas disponibles
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
            </Button>
            <Button variant="ghost" size="icon" disabled>
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground/80">
              <Maximize2 className="w-5 h-5" />
            </Button>
          </div>

          {/* Barre de progression */}
          <div className="flex items-center w-full max-w-xl space-x-2 text-xs">
            <span className="text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
            <Slider
              value={[progressValue]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
              disabled={duration === 0}
            />
            <span className="text-muted-foreground w-10 text-left">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Section du volume/extras */}
        <div className="flex items-center justify-end space-x-4 w-1/4">
          {/* Laissez cette section pour d'éventuels futurs contrôles de volume globaux ou de mixage */}
        </div>
      </div>
    </footer>
  );
};

export default MusicPlayer;