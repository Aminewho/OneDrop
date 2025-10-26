import React, { useState } from 'react';
import { Video } from "@shared/schema";
// 🛑 Importer les icônes nécessaires
import { Clock, Eye, Scissors } from "lucide-react"; 

interface VideoCardProps {
    video: Video;
    onView?: (videoId: string) => void; // Maintenu pour la cohérence
    onProcess?: (videoId: string) => void;
}

// Fonction utilitaire pour convertir la durée ISO 8601 (inchangée)
function formatDuration(isoDuration: string | undefined | null): string {
    if (!isoDuration || typeof isoDuration !== 'string') return 'N/A';
    
    const regex: RegExp = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches: RegExpMatchArray | null = isoDuration.match(regex);

    if (!matches) return 'N/A';

    const hours: number = parseInt(matches[1] || '0', 10);
    const minutes: number = parseInt(matches[2] || '0', 10);
    const seconds: number = parseInt(matches[3] || '0', 10);

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


export default function VideoCard({ video, onView, onProcess }: VideoCardProps) {
    const formattedDuration = formatDuration(video.duration);
    
    // 🛑 NOUVEL ÉTAT : Gère si le lecteur doit être affiché à la place de la vignette.
    const [isPlayerVisible, setIsPlayerVisible] = useState(false);

    // 🛑 CORRECTION : Gère l'action "Visualiser" (bouton Eye)
    const handleViewClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Empêche le clic de se propager
        
        // Bascule l'état pour afficher le lecteur vidéo.
        setIsPlayerVisible(true);
        
        // Optionnel: Appeler la prop onView si nécessaire pour la logique du parent
        if (onView) {
            onView(video.id);
        }
    };

    // Logique de l'action "Découper" (bouton Scissors) - inchangée
    const handleProcessClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onProcess) {
            onProcess(video.id);
        }
    };

    // Construction de l'URL d'intégration YouTube
    const embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1`;
    

    return (
        <div
            className="group cursor-pointer"
            data-testid={`card-video-${video.id}`}
        >
            <div className="relative aspect-video bg-muted rounded-md overflow-hidden mb-3">
                
                {/* 🛑 LOGIQUE D'AFFICHAGE CONDITIONNEL */}
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

                        {/* Overlay affiché au survol */}
                        <div
                            className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                        >
                            {/* Bouton 1: Visualiser la vidéo (Affiche l'iframe) */}
                            <button
                                onClick={handleViewClick}
                                title="Visualiser la vidéo"
                                className="p-3 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition-all duration-150 transform hover:scale-110 shadow-lg"
                            >
                                <Eye className="h-6 w-6" />
                            </button>

                            {/* Bouton 2: Découper la vidéo (Lancer Spleeter) */}
                            <button
                                onClick={handleProcessClick}
                                title="Découper et séparer les pistes audio (Spleeter)"
                                className="p-3 rounded-full bg-blue-600/80 hover:bg-blue-600 text-white transition-all duration-150 transform hover:scale-110 shadow-lg"
                            >
                                <Scissors className="h-6 w-6" />
                            </button>
                        </div>
                    </>
                )}
                {/* 🛑 FIN LOGIQUE D'AFFICHAGE CONDITIONNEL */}

            </div>
            
            <div className="space-y-1">
                <h3
                    className="font-medium text-sm line-clamp-2 text-foreground"
                    data-testid={`text-title-${video.id}`}
                >
                    {video.title}
                </h3>
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