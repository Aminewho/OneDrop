import React, { useState } from 'react';
import { Video } from "@shared/schema";
import { Clock, Eye, Scissors } from "lucide-react"; 

// 🛑 Importez ou définissez TaskStatus si elle est utilisée ici
// Si vous avez exporté TaskStatus dans Videos.tsx, vous pouvez l'importer.
type TaskStatus = 'PENDING' | 'DOWNLOADING' | 'SEPARATING' | 'FAILED' | 'COMPLETED' | 'UNKNOWN'|undefined;

interface VideoCardProps {
    video: Video;
    onView?: (videoId: string) => void;
    onProcess?: (videoId: string) => void;
    // 🛑 AJOUT CRITIQUE pour afficher le statut et désactiver le bouton
    taskStatus: TaskStatus; 
}

// Fonction utilitaire pour convertir la durée ISO 8601 (inchangée)
function formatDuration(isoDuration: string | null | undefined): string {
    // ... (Logique formatDuration inchangée)
    if (!isoDuration || typeof isoDuration !== 'string') return 'N/A';
    
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = isoDuration.match(regex);

    if (!matches) return 'N/A';

    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);

    const parts: string[] = [];

    if (hours > 0) {
        parts.push(hours.toString());
        parts.push(minutes.toString().padStart(2, '0'));
    } else {
        parts.push(minutes.toString());
    }
    
    parts.push(seconds.toString().padStart(2, '0'));

    return parts.join(':');
}


export default function VideoCard({ video, onView, onProcess, taskStatus }: VideoCardProps) {
    const formattedDuration = formatDuration(video.duration);
    const [isPlayerVisible, setIsPlayerVisible] = useState(false);

    // 🛑 LOGIQUE BASÉE SUR LE STATUT
    const isProcessing = taskStatus === 'DOWNLOADING' || taskStatus === 'SEPARATING' || taskStatus === 'PENDING';
    const isCompleted = taskStatus === 'COMPLETED';
    const isFailed = taskStatus === 'FAILED';

    const handleViewClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPlayerVisible(true);
        if (onView) {
            onView(video.id);
        }
    };

    const handleProcessClick = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (onProcess && !isProcessing && !isCompleted) {
            onProcess(video.id); // N'appelle que si non en cours et non complété
        }
    };

    const embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1`;
    
    // Texte d'état pour le bouton
    const buttonTitle = isProcessing 
        ? `Processing: ${taskStatus}` 
        : isCompleted 
        ? "Processing Complete"
        : isFailed
        ? "Failed. Click to retry"
        : "Découper et séparer les pistes audio (Spleeter)";


    return (
        <div
            className="group cursor-pointer"
            data-testid={`card-video-${video.id}`}
        >
            <div className="relative aspect-video bg-muted rounded-md overflow-hidden mb-3">
                
                {isPlayerVisible ? (
                    // 1. Lecteur YouTube intégré
                    <iframe
                        className="w-full h-full"
                        src={embedUrl}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        data-testid={`iframe-player-${video.id}`}
                    />
                ) : (
                    // 2. Vignette et Overlay
                    <>
                        <img
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            data-testid={`img-thumbnail-${video.id}`}
                        />
                        
                        {/* Affichage de la durée convertie */}
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                            {formattedDuration} 
                        </div>

                        {/* Overlay pour le bouton Visualiser (visible uniquement au survol de la vignette) */}
                        <div
                            className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                        >
                            {/* Bouton 1: Visualiser la vidéo */}
                            <button
                                onClick={handleViewClick}
                                title="Visualiser la vidéo"
                                className="p-3 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition-all duration-150 transform hover:scale-110 shadow-lg"
                            >
                                <Eye className="h-6 w-6" />
                            </button>
                        </div>
                    </>
                )}
                
                {/* 🛑 BOUTON DÉCOUPER AVEC AFFICHAGE DE STATUT */}
                <button
                    onClick={handleProcessClick}
                    disabled={isProcessing && !isFailed} // On permet de cliquer sur FAILED pour relancer
                    title={buttonTitle}
                    className={`absolute top-2 right-2 p-2 rounded-full text-white transition-all duration-150 transform hover:scale-110 shadow-lg 
                                opacity-0 group-hover:opacity-100 z-10
                                ${isProcessing ? 'bg-yellow-500 cursor-not-allowed' : 
                                  isCompleted ? 'bg-green-500 cursor-not-allowed' : 
                                  isFailed ? 'bg-red-500 hover:bg-red-600' :
                                  'bg-blue-600/80 hover:bg-blue-600'}`}
                >
                    {isProcessing ? (
                        // Spinner lucide-react (simule l'animation)
                        <Clock className="h-5 w-5 animate-spin" />
                    ) : (
                        <Scissors className="h-5 w-5" />
                    )}
                </button>

            </div>
            
            <div className="space-y-1">
                <h3
                    className="font-medium text-sm line-clamp-2 text-foreground"
                    data-testid={`text-title-${video.id}`}
                >
                    {video.title}
                </h3>
                {/* 🛑 AFFICHE LE STATUT SOUS LE TITRE QUAND C'EST IMPORTANT */}
                {isProcessing && <p className="text-yellow-500 text-xs font-semibold">Processing: {taskStatus}</p>}
                {isCompleted && <p className="text-green-500 text-xs font-semibold">Complete!</p>}
                {isFailed && <p className="text-red-500 text-xs font-semibold">Failed! Click ✂️ to retry.</p>}
                
                <p className="text-xs text-muted-foreground" data-testid={`text-channel-${video.id}`}>
                    {video.channel}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid={`text-date-${video.id}`}>{video.uploadedAt}</span>
                </div>
            </div>
        </div>
    );
}