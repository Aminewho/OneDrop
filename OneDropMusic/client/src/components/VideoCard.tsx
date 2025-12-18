import React, { useState, useMemo } from 'react';
import { Video } from "@shared/schema";
import { Clock, Eye, Scissors, X } from "lucide-react"; 

type TaskStatus = 'PENDING' | 'DOWNLOADING' | 'SEPARATING' | 'FAILED' | 'COMPLETED' | 'UNKNOWN' | undefined;

interface VideoCardProps {
    video: Video;
    onView?: (videoId: string) => void;
    onProcess?: (videoId: string) => void;
    taskStatus: TaskStatus; 
}

function formatDuration(isoDuration: string | null | undefined): string {
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
    const formattedDuration = useMemo(() => formatDuration(video.duration), [video.duration]);
    const [isPlayerVisible, setIsPlayerVisible] = useState(false);

    const isProcessing = taskStatus === 'DOWNLOADING' || taskStatus === 'SEPARATING' || taskStatus === 'PENDING';
    const isCompleted = taskStatus === 'COMPLETED';
    const isFailed = taskStatus === 'FAILED';

    // 🛠️ CONSTRUCTION SÉCURISÉE DE L'URL EMBED
    // L'ajout de 'origin' est crucial pour éviter les blocages sur 127.0.0.1
    const embedUrl = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const params = new URLSearchParams({
            autoplay: '1',
            origin: origin,
            rel: '0',
            enablejsapi: '1',
            modestbranding: '1'
        });
        return `https://www.youtube-nocookie.com/embed/${video.id}?${params.toString()}`;
    }, [video.id]);

    const handleViewClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPlayerVisible(true);
        if (onView) onView(video.id);
    };

    const handleProcessClick = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (onProcess && !isProcessing && !isCompleted) {
            onProcess(video.id);
        }
    };

    const buttonTitle = isProcessing 
        ? `Processing: ${taskStatus}` 
        : isCompleted 
        ? "Processing Complete"
        : isFailed
        ? "Failed. Click to retry"
        : "Découper et séparer les pistes audio (Spleeter)";

    return (
        <div className="group cursor-pointer" data-testid={`card-video-${video.id}`}>
            <div className="relative aspect-video bg-muted rounded-md overflow-hidden mb-3 shadow-sm border border-border/40">
                
                {isPlayerVisible ? (
                    <div className="relative w-full h-full animate-in fade-in duration-300">
                        <iframe
                            className="w-full h-full"
                            src={embedUrl}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            // Le sandbox permet de limiter les risques de sécurité tout en laissant l'iframe fonctionner
                            sandbox="allow-forms allow-scripts allow-pointer-lock allow-same-origin allow-presentation"
                        />
                        {/* Bouton pour fermer le lecteur et revenir à la vignette */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsPlayerVisible(false); }}
                            className="absolute top-2 left-2 p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors z-20"
                            title="Fermer le lecteur"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        <img
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono font-medium">
                            {formattedDuration} 
                        </div>

                        {/* Overlay au survol */}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={handleViewClick}
                                className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-transform duration-200 transform hover:scale-110 shadow-xl"
                            >
                                <Eye className="h-6 w-6" />
                            </button>
                        </div>
                    </>
                )}
                
                {/* Bouton de traitement (Spleeter) */}
                <button
                    onClick={handleProcessClick}
                    disabled={isProcessing && !isFailed}
                    title={buttonTitle}
                    className={`absolute top-2 right-2 p-2.5 rounded-full text-white transition-all duration-200 transform hover:scale-110 shadow-md z-10
                                ${!isPlayerVisible ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}
                                ${isProcessing ? 'bg-yellow-500 cursor-wait' : 
                                  isCompleted ? 'bg-green-500 cursor-default' : 
                                  isFailed ? 'bg-red-500 hover:bg-red-600' :
                                  'bg-blue-600/90 hover:bg-blue-600'}`}
                >
                    {isProcessing ? (
                        <Clock className="h-5 w-5 animate-spin" />
                    ) : (
                        <Scissors className="h-5 w-5" />
                    )}
                </button>
            </div>
            
            <div className="space-y-1.5 px-1">
                <h3 className="font-semibold text-sm line-clamp-2 text-foreground leading-snug group-hover:text-primary transition-colors">
                    {video.title}
                </h3>
                
                {/* Affichage des états de traitement */}
                <div className="min-h-[1.25rem]">
                    {isProcessing && (
                        <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500 text-xs font-bold">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                            </span>
                            {taskStatus}...
                        </div>
                    )}
                    {isCompleted && <p className="text-green-600 dark:text-green-500 text-xs font-bold">✓ Ready to use</p>}
                    {isFailed && <p className="text-red-500 text-xs font-bold">× Failed (Click icon to retry)</p>}
                    
                    {!isProcessing && !isCompleted && !isFailed && (
                        <p className="text-xs text-muted-foreground truncate">
                            {video.channel}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 uppercase tracking-wider font-medium">
                    <span>{video.uploadedAt}</span>
                    {isCompleted && <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 rounded">Processed</span>}
                </div>
            </div>
        </div>
    );
}