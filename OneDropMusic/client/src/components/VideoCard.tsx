import React, { useState, useMemo } from 'react';
import { Clock, Eye, Scissors, X } from "lucide-react"; 

type TaskStatus = 'PENDING' | 'DOWNLOADING' | 'SEPARATING' | 'FAILED' | 'COMPLETED' | 'UNKNOWN' | undefined;

export interface Video {
    id: string;
    title: string;
    thumbnail: string;
    channel: string;
    views?: string;
}

interface VideoCardProps {
    video: Video;
    onView?: (videoId: string) => void;
    onProcess?: (videoId: string) => void;
    taskStatus: TaskStatus; 
}

export default function VideoCard({ video, onView, onProcess, taskStatus }: VideoCardProps) {
    const [isPlayerVisible, setIsPlayerVisible] = useState(false);

    const isProcessing = taskStatus === 'DOWNLOADING' || taskStatus === 'SEPARATING' || taskStatus === 'PENDING';
    const isCompleted = taskStatus === 'COMPLETED';
    const isFailed = taskStatus === 'FAILED';

    // 🛠️ Embed URL Construction
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
            <div className="
                relative
                aspect-video
                overflow-hidden
                rounded-xl
                bg-card
                border
                border-border
                shadow-sm
            ">
                
                {isPlayerVisible ? (
                    <div className="relative w-full h-full animate-in fade-in duration-300">
                        <iframe
                            className="w-full h-full"
                            src={embedUrl}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            sandbox="allow-forms allow-scripts allow-pointer-lock allow-same-origin allow-presentation"
                        />
                        {/* Close player button */}
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

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={handleViewClick}
                                className="p-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform duration-200 transform hover:scale-110 shadow-xl"
                            >
                                <Eye className="h-6 w-6" />
                            </button>
                        </div>
                    </>
                )}
                
                {/* Spleeter processing button */}
                <button
                    onClick={handleProcessClick}
                    disabled={isProcessing && !isFailed}
                    title={buttonTitle}
                    className={`absolute top-2 right-2 p-2.5 rounded-full text-white transition-all duration-200 transform hover:scale-110 shadow-md z-10
                               ${!isPlayerVisible ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}
                                    ${isProcessing
                                    ? 'bg-secondary cursor-wait'
                                    : isCompleted
                                    ? 'bg-accent cursor-default'
                                    : isFailed
                                    ? 'bg-destructive'
                                    : 'bg-primary hover:bg-primary/90'}`}
                >
                    {isProcessing ? (
                        <Clock className="h-5 w-5 animate-spin" />
                    ) : (
                        <Scissors className="h-5 w-5" />
                    )}
                </button>
            </div>
            
            <div className="space-y-1.5 px-1 pt-2">
                <h3 className="font-semibold text-sm line-clamp-2 text-foreground leading-snug group-hover:text-primary transition-colors">
                    {video.title}
                </h3>

                <p className="text-xs text-muted-foreground truncate">
                    {video.channel}
                </p>

                {/* Displaying view count and processing status */}
                <div className="flex items-center justify-between text-xs text-muted-foreground/80 font-medium">
                    <span>{video.views || ''}</span>

                    {isProcessing && (
                        <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500 text-xs font-bold">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                            </span>
                            {taskStatus}...
                        </div>
                    )}
                    {isCompleted && <span className="text-green-600 dark:text-green-500 text-xs font-bold">✓ Ready</span>}
                    {isFailed && <span className="text-red-500 text-xs font-bold">× Failed</span>}
                </div>
            </div>
        </div>
    );
}