import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { Loader2, Music, Zap, Volume2, Disc3, Aperture, ArrowLeft, Play, Pause, X, ArrowRight, Repeat2, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";

// --- Mock Components ---

interface CardProps {
    children?: ReactNode;
    className?: string;
}
const Card = ({ children, className }: CardProps) => (
    <div className={`rounded-2xl border border-white/5 bg-[#141416] text-gray-100 shadow-2xl ${className}`}>
        {children}
    </div>
);

interface ButtonProps {
    children?: ReactNode;
    onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    variant?: 'default' | 'outline' | 'secondary' | 'danger' | 'ghost' | string;
    disabled?: boolean;
    size?: 'default' | 'icon' | 'sm' | string;
}

const Button = ({ children, onClick, className, variant = "default", disabled = false, size = "default" }: ButtonProps) => {
    let baseStyles = "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/50 active:scale-95";
    let sizeStyles = size === 'icon' ? 'h-10 w-10 p-2' : size === 'sm' ? 'h-8 px-3 py-1 text-xs' : 'h-10 px-4 py-2';

    let variantStyles = '';
    switch (variant) {
        case 'default':
            variantStyles = 'bg-amber-500 text-black hover:bg-amber-400 font-semibold shadow-lg shadow-amber-500/20';
            break;
        case 'outline':
            variantStyles = 'bg-transparent border border-white/10 text-gray-300 hover:bg-white/5 hover:border-white/20';
            break;
        case 'secondary':
            variantStyles = 'bg-white/5 text-gray-200 hover:bg-white/10 border border-white/5';
            break;
        case 'danger':
            variantStyles = 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30';
            break;
        case 'ghost':
            variantStyles = 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5';
            break;
        default:
            variantStyles = 'bg-amber-500 text-black hover:bg-amber-400 font-semibold';
    }

    return (
        <button
            onClick={onClick}
            className={`${baseStyles} ${sizeStyles} ${variantStyles} ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''} ${className}`}
            disabled={disabled}
        >
            {children}
        </button>
    );
};


// --- TYPES ---
interface StudioData {
    videoId: string;
    trackTitle: string;
    stemNames: string[];
}

interface StemControl {
    name: string;
    volume: number;
    isMuted: boolean;
    isPlaying: boolean;
    audioUrl: string;
    buffer: AudioBuffer | null;
    gainNode: GainNode | null;
    sourceNode: AudioBufferSourceNode | null;
    hasLoadError: boolean;
}

const API_BASE_URL = "http://127.0.0.1:8081";

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toFixed(0).padStart(2, '0')}`;
};

const getStemAudioUrl = (videoId: string, stemName: string): string => {
    return `${API_BASE_URL}/api/audio/serve/track?videoId=${videoId}&trackName=${stemName}`;
};

// Stem color config
const STEM_CONFIG: Record<string, { color: string; bg: string; icon: ReactNode; label: string }> = {
    vocals:  { color: '#f87171', bg: 'rgba(248,113,113,0.08)', icon: <Music  className="w-4 h-4" />, label: 'Vocals'  },
    drums:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  icon: <Disc3  className="w-4 h-4" />, label: 'Drums'   },
    drum:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  icon: <Disc3  className="w-4 h-4" />, label: 'Drums'   },
    bass:    { color: '#34d399', bg: 'rgba(52,211,153,0.08)',  icon: <Aperture className="w-4 h-4" />, label: 'Bass' },
    other:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  icon: <Zap    className="w-4 h-4" />, label: 'Other'   },
};

const getStemConfig = (name: string) =>
    STEM_CONFIG[name.toLowerCase()] ?? STEM_CONFIG['other'];


// --- MAIN COMPONENT ---

export default function Separator() {
    const [, setLocation] = useLocation();
    const [studioData, setStudioData] = useState<StudioData | null>(null);
    const [stems, setStems] = useState<StemControl[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [isAllPlaying, setIsAllPlaying] = useState(false);

    const [maxDuration, setMaxDuration] = useState(0);
    const [playbackTime, setPlaybackTime] = useState(0);

    const [loopStart, setLoopStart] = useState(0.01);
    const [loopEnd, setLoopEnd] = useState(0);
    const [isLooping, setIsLooping] = useState(false);

    // Tempo: percentage 50–200, default 100
    const [tempo, setTempo] = useState(100);

    const audioContextRef = useRef<AudioContext | null>(null);
    const playbackStartTimeRef = useRef<number | null>(null);
    const playbackPositionRef = useRef(0);

    const seekBarRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef<'start' | 'end' | null>(null);

    const loadAndDecodeAudio = async (url: string, context: AudioContext): Promise<AudioBuffer> => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    };

    const createAndStartSource = useCallback((
        stem: StemControl,
        context: AudioContext,
        offset = 0,
        isLoopingProp: boolean,
        loopStartProp: number,
        loopEndProp: number,
        tempoProp: number
    ): AudioBufferSourceNode => {
        if (!stem.buffer || !stem.gainNode) throw new Error("Audio nodes not ready.");

        const source = context.createBufferSource();
        source.buffer = stem.buffer;
        source.playbackRate.value = tempoProp / 100;

        let actualOffset = offset;

        if (isLoopingProp && loopEndProp > loopStartProp) {
            source.loop = true;
            source.loopStart = loopStartProp;
            source.loopEnd = loopEndProp;
            if (actualOffset < loopStartProp || actualOffset >= loopEndProp) {
                actualOffset = loopStartProp;
            }
        } else {
            source.loop = false;
            if (stem.buffer.duration > 0) {
                actualOffset %= stem.buffer.duration;
            } else {
                actualOffset = 0;
            }
        }

        source.connect(stem.gainNode);
        const scheduledTime = context.currentTime + 0.05;
        source.start(scheduledTime, actualOffset);

        return source;
    }, []);

    // 1. Init AudioContext + load buffers
    useEffect(() => {
        const dataString = localStorage.getItem('currentStudioData');
        if (!dataString) {
            try { setLocation('/library'); } catch (e) { console.error(e); }
            return;
        }

        const data: StudioData = JSON.parse(dataString);
        setStudioData(data);

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(console.error);
            }
        }
        const context = audioContextRef.current;

        const initialStems: StemControl[] = data.stemNames.map(name => ({
            name, volume: 0.8, isMuted: false, isPlaying: false,
            audioUrl: getStemAudioUrl(data.videoId, name),
            buffer: null, gainNode: null, sourceNode: null, hasLoadError: false,
        }));
        setStems(initialStems);

        const loadAllStems = async () => {
            const newStems = [...initialStems];
            let hasError = false;
            let maxDurationFound = 0;

            await Promise.all(newStems.map(async (stem, i) => {
                const gainNode = context.createGain();
                gainNode.gain.value = stem.volume;
                gainNode.connect(context.destination);
                newStems[i].gainNode = gainNode;

                try {
                    const buffer = await loadAndDecodeAudio(stem.audioUrl, context);
                    newStems[i].buffer = buffer;
                    if (buffer.duration > maxDurationFound) maxDurationFound = buffer.duration;
                } catch (e) {
                    console.error(`Error loading stem ${stem.name}:`, e);
                    newStems[i].hasLoadError = true;
                    hasError = true;
                }
            }));

            setStems(newStems);
            setIsInitializing(false);

            if (!hasError) {
                setIsAudioReady(true);
                setMaxDuration(maxDurationFound);
                setLoopEnd(maxDurationFound);
            } else {
                setIsAudioReady(false);
            }
        };

        loadAllStems();

        return () => {
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try { stem.sourceNode.stop(context.currentTime + 0.01); } catch (e) {}
                }
                return { ...stem, sourceNode: null, isPlaying: false };
            }));
            if (context && context.state !== 'closed') {
                context.suspend().catch(console.error);
            }
        };
    }, [setLocation]);

    // 2. Time tracking (rAF)
    useEffect(() => {
        let animationFrameId: number | null = null;
        const context = audioContextRef.current;

        const updateTime = () => {
            if (context && playbackStartTimeRef.current !== null) {
                const elapsed = context.currentTime - playbackStartTimeRef.current;
                let currentTotalTime = playbackPositionRef.current + elapsed * (tempo / 100);

                if (isLooping && loopEnd > loopStart) {
                    if (currentTotalTime >= loopEnd) {
                        const loopLength = loopEnd - loopStart;
                        currentTotalTime = loopStart + ((currentTotalTime - loopEnd) % loopLength);
                    }
                    if (currentTotalTime < loopStart) currentTotalTime = loopStart;
                } else if (maxDuration > 0 && currentTotalTime >= maxDuration) {
                    currentTotalTime = currentTotalTime % maxDuration;
                }
                setPlaybackTime(currentTotalTime);
            }
            animationFrameId = requestAnimationFrame(updateTime);
        };

        if (isAllPlaying) {
            animationFrameId = requestAnimationFrame(updateTime);
        }

        return () => {
            if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAllPlaying, maxDuration, isLooping, loopStart, loopEnd, tempo]);

    // 3. Play / Pause
    const toggleAllPlayback = useCallback(() => {
        if (!isAudioReady || !audioContextRef.current) return;
        const context = audioContextRef.current;
        const shouldPlay = !isAllPlaying;

        if (shouldPlay) {
            if (context.state !== 'running') {
                context.resume().catch(console.error);
            }

            let actualOffset = playbackPositionRef.current;
            const currentLoopState = isLooping;
            const currentLoopStart = loopStart;
            const currentLoopEnd = loopEnd;
            const currentTempo = tempo;

            if (currentLoopState && currentLoopEnd > currentLoopStart) {
                if (actualOffset < currentLoopStart || actualOffset >= currentLoopEnd) actualOffset = currentLoopStart;
            } else if (maxDuration > 0) {
                actualOffset %= maxDuration;
            }

            const scheduledTime = context.currentTime + 0.05;
            playbackStartTimeRef.current = scheduledTime;

            setStems(prevStems => prevStems.map(stem => {
                if (stem.hasLoadError || !stem.buffer || !stem.gainNode) return stem;
                try {
                    if (stem.sourceNode) {
                        try { stem.sourceNode.stop(0); } catch (e) {}
                    }
                    const newSource = createAndStartSource(stem, context, actualOffset, currentLoopState, currentLoopStart, currentLoopEnd, currentTempo);
                    return { ...stem, isPlaying: true, sourceNode: newSource };
                } catch (e) {
                    console.error(`Failed to start stem ${stem.name}:`, e);
                    return { ...stem, isPlaying: false };
                }
            }));
        } else {
            if (playbackStartTimeRef.current !== null && context) {
                const elapsed = context.currentTime - playbackStartTimeRef.current;
                let newPosition = playbackPositionRef.current + elapsed * (tempo / 100);

                if (isLooping && loopEnd > loopStart && newPosition >= loopEnd) {
                    newPosition = loopStart + ((newPosition - loopEnd) % (loopEnd - loopStart));
                } else if (maxDuration > 0) {
                    newPosition %= maxDuration;
                }
                playbackPositionRef.current = newPosition;
            }

            setPlaybackTime(playbackPositionRef.current);
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try { stem.sourceNode.stop(0); } catch (e) {}
                }
                return { ...stem, isPlaying: false, sourceNode: null };
            }));

            playbackStartTimeRef.current = null;
            context.suspend().catch(console.error);
        }

        setIsAllPlaying(shouldPlay);
    }, [isAllPlaying, isAudioReady, maxDuration, createAndStartSource, isLooping, loopStart, loopEnd, tempo]);

    // 4. Seek
    const handleSeek = useCallback((newTime: number, forceLoopState?: boolean) => {
        if (!audioContextRef.current || !isAudioReady || maxDuration === 0) return;
        const context = audioContextRef.current;
        const currentLoopState = forceLoopState !== undefined ? forceLoopState : isLooping;

        let clampedTime = Math.max(0, Math.min(newTime, maxDuration));
        if (currentLoopState && loopEnd > loopStart) {
            if (clampedTime < loopStart || clampedTime >= loopEnd) clampedTime = loopStart;
        } else if (maxDuration > 0) {
            clampedTime = clampedTime % maxDuration;
        }

        playbackPositionRef.current = clampedTime;
        setPlaybackTime(clampedTime);

        if (isAllPlaying) {
            setStems(prevStems => prevStems.map(stem => {
                if (stem.sourceNode) {
                    try { stem.sourceNode.stop(0); } catch (e) {}
                }
                return { ...stem, sourceNode: null };
            }));

            const scheduledTime = context.currentTime + 0.05;
            playbackStartTimeRef.current = scheduledTime;

            setStems(prevStems => prevStems.map(stem => {
                if (stem.hasLoadError || !stem.buffer || !stem.gainNode) return stem;
                try {
                    const newSource = createAndStartSource(stem, context, clampedTime, currentLoopState, loopStart, loopEnd, tempo);
                    return { ...stem, isPlaying: true, sourceNode: newSource };
                } catch (e) {
                    return { ...stem, isPlaying: false };
                }
            }));
        }
    }, [isAllPlaying, isAudioReady, maxDuration, createAndStartSource, isLooping, loopStart, loopEnd, tempo]);

    // 5. Toggle Loop
    const toggleLoop = useCallback(() => {
        if (!isAudioReady || maxDuration === 0) return;
        const nextLoopState = !isLooping;

        if (!nextLoopState) {
            const wasPlaying = isAllPlaying;
            if (wasPlaying) toggleAllPlayback();
            setIsLooping(false);
            setLoopStart(0.01);
            setLoopEnd(maxDuration);
            if (wasPlaying) setTimeout(() => toggleAllPlayback(), 50);
        } else {
            setIsLooping(true);
            if (isAllPlaying) handleSeek(playbackTime, true);
        }
    }, [isLooping, isAllPlaying, maxDuration, playbackTime, isAudioReady, toggleAllPlayback, handleSeek]);

    // 6. Rewind / Forward
    const handleRewind = useCallback(() => {
        if (!isAudioReady || maxDuration === 0) return;
        handleSeek(Math.max(0, playbackTime - 5));
    }, [isAudioReady, playbackTime, maxDuration, handleSeek]);

    const handleForward = useCallback(() => {
        if (!isAudioReady || maxDuration === 0) return;
        handleSeek((playbackTime + 5) % maxDuration);
    }, [isAudioReady, maxDuration, playbackTime, handleSeek]);

    // 7. Tempo control
    const handleTempoChange = useCallback((newTempo: number) => {
        const clamped = Math.max(50, Math.min(200, newTempo));
        setTempo(clamped);

        // Update rate on any currently-playing source nodes
        setStems(prevStems => prevStems.map(stem => {
            if (stem.sourceNode) {
                try {
                    stem.sourceNode.playbackRate.value = clamped / 100;
                } catch (e) {}
            }
            return stem;
        }));
    }, []);

    // 8. Volume
    const handleVolumeChange = useCallback((name: string, newVolume: number) => {
        setStems(prevStems => prevStems.map(stem => {
            if (stem.name === name) {
                const finalVolume = stem.isMuted ? 0 : newVolume;
                if (stem.gainNode && audioContextRef.current) {
                    stem.gainNode.gain.setValueAtTime(finalVolume, audioContextRef.current.currentTime);
                }
                return { ...stem, volume: newVolume };
            }
            return stem;
        }));
    }, []);

    // 9. Mute
    const toggleMute = useCallback((name: string) => {
        setStems(prevStems => prevStems.map(stem => {
            if (stem.name === name) {
                const newMuted = !stem.isMuted;
                if (stem.gainNode && audioContextRef.current) {
                    stem.gainNode.gain.setValueAtTime(newMuted ? 0 : stem.volume, audioContextRef.current.currentTime);
                }
                return { ...stem, isMuted: newMuted };
            }
            return stem;
        }));
    }, []);

    // Drag handlers for A-B loop markers
    const positionToTime = useCallback((clientX: number): number => {
        if (!seekBarRef.current || maxDuration === 0) return 0;
        const rect = seekBarRef.current.getBoundingClientRect();
        const normalized = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
        return normalized * maxDuration;
    }, [maxDuration]);

    const handleDrag = useCallback((clientX: number) => {
        if (!isDraggingRef.current || maxDuration === 0) return;
        let t = positionToTime(clientX);
        if (isDraggingRef.current === 'start') setLoopStart(Math.max(0.01, Math.min(t, loopEnd - 0.1)));
        else setLoopEnd(Math.min(maxDuration, Math.max(t, loopStart + 0.1)));
    }, [maxDuration, loopStart, loopEnd, positionToTime]);

    const handleDragEnd = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = null;
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
        if (isAllPlaying) handleSeek(playbackTime);
    }, [isAllPlaying, handleSeek, playbackTime]);

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => handleDrag(e.clientX), [handleDrag]);
    const handleGlobalMouseUp = useCallback(() => handleDragEnd(), [handleDragEnd]);
    const handleGlobalTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length > 0) { e.preventDefault(); handleDrag(e.touches[0].clientX); }
    }, [handleDrag]);
    const handleGlobalTouchEnd = useCallback(() => handleDragEnd(), [handleDragEnd]);

    const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: 'start' | 'end') => {
        if ('touches' in e && e.touches.length > 0) e.preventDefault();
        isDraggingRef.current = type;
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
        document.addEventListener('touchend', handleGlobalTouchEnd);
    }, [handleGlobalMouseMove, handleGlobalMouseUp, handleGlobalTouchMove, handleGlobalTouchEnd]);

    const playbackPercent = maxDuration > 0 ? (playbackTime / maxDuration) * 100 : 0;
    const hasLoadError = stems.some(s => s.hasLoadError);

    // Loading state
    if (isInitializing || !isAudioReady) {
        const loadedCount = stems.filter(s => s.buffer).length;
        const totalCount = stems.length;
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0c0e]">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                    <Disc3 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-amber-500/60" />
                </div>
                <p className="mt-6 text-gray-400 text-sm tracking-widest uppercase font-mono">
                    {isInitializing && totalCount > 0 ? `Preparing ${totalCount} tracks` : `Loading ${loadedCount} / ${totalCount}`}
                </p>
                {hasLoadError && (
                    <p className="mt-3 text-xs text-red-400 flex items-center gap-1">
                        <X className="w-3 h-3" /> Some tracks failed to load
                    </p>
                )}
            </div>
        );
    }

    if (!studioData) {
        return <div className="p-6 text-center text-red-400 min-h-screen bg-[#0c0c0e] flex items-center justify-center">Missing studio data. Return to library.</div>;
    }

    return (
        <div className="min-h-screen bg-[#0c0c0e] p-4 sm:p-8" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Button
                        variant="ghost"
                        onClick={() => { if (isAllPlaying) toggleAllPlayback(); setLocation('/library'); }}
                        className="text-gray-400 hover:text-white gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">Library</span>
                    </Button>

                    <div className="text-center">
                        <p className="text-xs text-amber-500 tracking-[0.2em] uppercase font-mono mb-1">Now Editing</p>
                        <h1 className="text-lg font-semibold text-white truncate max-w-[260px]" title={studioData.trackTitle}>
                            {studioData.trackTitle}
                        </h1>
                    </div>

                    <div className="w-24" />
                </div>

                {/* ─── PLAYER BAR ─── */}
                <div className="mb-4 p-5 rounded-2xl bg-[#141416] border border-white/5 shadow-2xl">

                    {/* Seek bar */}
                    <div className="flex items-center gap-3 mb-5">
                        <span className="text-xs font-mono text-gray-500 w-10 text-right shrink-0 tabular-nums">
                            {formatTime(playbackTime)}
                        </span>

                        <div className="flex-1 relative h-1.5 flex items-center" ref={seekBarRef}>
                            {/* Track bg */}
                            <div className="absolute inset-0 h-1.5 bg-white/8 rounded-full" />

                            {/* Loop zone */}
                            {isLooping && loopEnd > loopStart && (
                                <div
                                    className="absolute h-1.5 bg-amber-500/30 z-0 rounded-full"
                                    style={{
                                        left: `${(loopStart / maxDuration) * 100}%`,
                                        width: `${((loopEnd - loopStart) / maxDuration) * 100}%`,
                                    }}
                                />
                            )}

                            {/* Progress */}
                            <input
                                type="range"
                                min="0" max={maxDuration} step="0.01"
                                value={playbackTime}
                                onChange={e => setPlaybackTime(parseFloat(e.target.value))}
                                onMouseUp={e => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
                                onTouchEnd={e => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
                                disabled={!isAudioReady || hasLoadError}
                                className="appearance-none h-1.5 rounded-full w-full relative z-10 cursor-pointer"
                                style={{
                                    WebkitAppearance: 'none',
                                    background: `linear-gradient(to right, #f59e0b ${playbackPercent}%, transparent ${playbackPercent}%, transparent 100%)`,
                                } as React.CSSProperties}
                            />

                            {/* Loop handles */}
                            {maxDuration > 0 && isLooping && (
                                <>
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 z-20 cursor-ew-resize touch-none"
                                        style={{ left: `${(loopStart / maxDuration) * 100}%`, transform: 'translateX(-50%)' }}
                                        onMouseDown={e => handleDragStart(e, 'start')}
                                        onTouchStart={e => handleDragStart(e, 'start')}
                                    >
                                        <div className="w-1.5 h-4 bg-amber-400 rounded-full shadow-lg shadow-amber-400/30" />
                                    </div>
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 z-20 cursor-ew-resize touch-none"
                                        style={{ left: `${(loopEnd / maxDuration) * 100}%`, transform: 'translateX(-50%)' }}
                                        onMouseDown={e => handleDragStart(e, 'end')}
                                        onTouchStart={e => handleDragStart(e, 'end')}
                                    >
                                        <div className="w-1.5 h-4 bg-amber-400 rounded-full shadow-lg shadow-amber-400/30" />
                                    </div>
                                </>
                            )}
                        </div>

                        <span className="text-xs font-mono text-gray-500 w-10 text-left shrink-0 tabular-nums">
                            -{formatTime(maxDuration - playbackTime)}
                        </span>
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center justify-between">

                        {/* Left: Loop toggle */}
                        <div className="flex items-center gap-2 w-1/3">
                            <button
                                onClick={toggleLoop}
                                disabled={isLooping && loopStart >= loopEnd}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                                    isLooping
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                                        : 'bg-transparent border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                                }`}
                            >
                                <Repeat2 className="w-3.5 h-3.5" />
                                Loop
                            </button>
                        </div>

                        {/* Center: Transport */}
                        <div className="flex items-center gap-3 justify-center w-1/3">
                            <button
                                onClick={handleRewind}
                                disabled={!isAudioReady || hasLoadError}
                                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>

                            <button
                                onClick={toggleAllPlayback}
                                disabled={!isAudioReady || hasLoadError}
                                className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-amber-500/30 disabled:opacity-40"
                            >
                                {isAllPlaying
                                    ? <Pause className="w-5 h-5 fill-black text-black" />
                                    : <Play  className="w-5 h-5 fill-black text-black ml-0.5" />
                                }
                            </button>

                            <button
                                onClick={handleForward}
                                disabled={!isAudioReady || hasLoadError}
                                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                            >
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Right: Tempo */}
                        <div className="flex items-center justify-end w-1/3">
                            <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
                                <span className="text-xs text-gray-500 font-mono mr-1">BPM</span>

                                <button
                                    onClick={() => handleTempoChange(tempo - 5)}
                                    disabled={!isAudioReady || tempo <= 50}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                                >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </button>

                                <span className={`text-sm font-mono font-semibold tabular-nums w-8 text-center transition-colors ${
                                    tempo !== 100 ? 'text-amber-400' : 'text-white'
                                }`}>
                                    {tempo}
                                </span>

                                <button
                                    onClick={() => handleTempoChange(tempo + 5)}
                                    disabled={!isAudioReady || tempo >= 200}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                                >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                </button>

                                {tempo !== 100 && (
                                    <button
                                        onClick={() => handleTempoChange(100)}
                                        className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-amber-400 transition-colors ml-0.5"
                                        title="Reset tempo"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* ─── A-B LOOP CONTROLS ─── */}
                {isLooping && (
                    <div className="mb-4 p-4 rounded-2xl bg-[#141416] border border-amber-500/15 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-amber-500 font-mono tracking-widest uppercase">A–B Loop</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setLoopStart(Math.max(0.01, playbackTime))}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono hover:bg-blue-500/20 transition-colors"
                                >
                                    <span className="font-bold">A</span>
                                    <span className="text-blue-300/70">{formatTime(loopStart)}</span>
                                </button>
                                <button
                                    onClick={() => setLoopEnd(Math.min(maxDuration, playbackTime))}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono hover:bg-rose-500/20 transition-colors"
                                >
                                    <span className="font-bold">B</span>
                                    <span className="text-rose-300/70">{formatTime(loopEnd)}</span>
                                </button>
                            </div>
                        </div>

                        {loopStart >= loopEnd && (
                            <p className="mt-3 text-xs text-red-400 text-center">
                                ⚠ Point A must be before point B
                            </p>
                        )}
                    </div>
                )}

                {/* ─── STEM TRACKS ─── */}
                <div className="space-y-3">
                    {stems.map((stem) => {
                        const cfg = getStemConfig(stem.name);
                        const isActive = stem.isPlaying && !stem.isMuted;

                        return (
                            <div
                                key={stem.name}
                                className="p-4 rounded-2xl border transition-all duration-300"
                                style={{
                                    backgroundColor: '#141416',
                                    borderColor: isActive ? `${cfg.color}30` : 'rgba(255,255,255,0.05)',
                                    boxShadow: isActive ? `0 0 20px ${cfg.color}10` : 'none',
                                }}
                            >
                                <div className="flex items-center gap-4">

                                    {/* Icon badge */}
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                                        style={{
                                            backgroundColor: isActive ? `${cfg.color}20` : 'rgba(255,255,255,0.05)',
                                            color: isActive ? cfg.color : '#6b7280',
                                        }}
                                    >
                                        {cfg.icon}
                                    </div>

                                    {/* Name */}
                                    <span
                                        className="text-sm font-semibold w-16 shrink-0 transition-colors duration-300"
                                        style={{ color: isActive ? cfg.color : '#9ca3af' }}
                                    >
                                        {cfg.label}
                                    </span>

                                    {/* Error badge */}
                                    {stem.hasLoadError && (
                                        <span className="px-2 py-0.5 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-md shrink-0">
                                            ERR
                                        </span>
                                    )}

                                    {/* Volume fader */}
                                    <div className="flex items-center gap-3 flex-1">
                                        {/* Mute button */}
                                        <button
                                            onClick={() => toggleMute(stem.name)}
                                            disabled={stem.hasLoadError || !isAudioReady}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                                stem.isMuted
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    : 'bg-white/5 text-gray-400 hover:text-white border border-white/5 hover:border-white/15'
                                            } disabled:opacity-30`}
                                        >
                                            <Volume2 className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Slider */}
                                        <input
                                            type="range"
                                            min="0" max="1" step="0.01"
                                            value={stem.volume}
                                            onChange={e => handleVolumeChange(stem.name, parseFloat(e.target.value))}
                                            disabled={stem.hasLoadError || !isAudioReady}
                                            className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer disabled:opacity-30"
                                            style={{
                                                WebkitAppearance: 'none',
                                                background: stem.isMuted
                                                    ? `linear-gradient(to right, rgba(255,255,255,0.15) ${stem.volume * 100}%, rgba(255,255,255,0.05) ${stem.volume * 100}%)`
                                                    : `linear-gradient(to right, ${cfg.color} ${stem.volume * 100}%, rgba(255,255,255,0.07) ${stem.volume * 100}%)`,
                                            } as React.CSSProperties}
                                        />

                                        {/* Volume % */}
                                        <span className="text-xs font-mono tabular-nums w-8 text-right shrink-0"
                                              style={{ color: stem.isMuted ? '#4b5563' : '#6b7280' }}>
                                            {Math.round(stem.volume * 100)}
                                        </span>
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer hint */}
                <p className="text-center text-xs text-gray-600 mt-8 font-mono tracking-wider">
                    {tempo !== 100 ? `TEMPO ${tempo}% · ` : ''}{stems.length} TRACKS · {formatTime(maxDuration)}
                </p>

            </div>
        </div>
    );
}