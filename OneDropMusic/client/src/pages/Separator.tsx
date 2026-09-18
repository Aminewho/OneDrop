import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { useBpm } from '../hooks/useBpm';
import * as Tone from "tone";
import {
    Music, Zap, Disc3, Aperture, ArrowLeft, Play, Pause,
    ArrowRight, Repeat2, RotateCcw,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StudioData { videoId: string; trackTitle: string; stemNames: string[]; }
interface StemControl { name: string; volume: number; isMuted: boolean; isSoloed: boolean; hasLoadError: boolean; }

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL  = "http://localhost:8081";
const RULER_H       = 44;
const TRACK_H       = 68;

const getStemAudioUrl = (videoId: string, stemName: string) =>
    `${API_BASE_URL}/api/audio/serve/track?videoId=${videoId}&trackName=${stemName}`;

const STEM_CONFIG: Record<string, { icon: ReactNode; label: string }> = {
    vocals: { icon: <Music   className="w-3.5 h-3.5" />, label: "Vocals" },
    drums:  { icon: <Disc3   className="w-3.5 h-3.5" />, label: "Drums"  },
    drum:   { icon: <Disc3   className="w-3.5 h-3.5" />, label: "Drums"  },
    bass:   { icon: <Aperture className="w-3.5 h-3.5"/>, label: "Bass"   },
    other:  { icon: <Zap     className="w-3.5 h-3.5" />, label: "Other"  },
};
const getCfg = (name: string) => STEM_CONFIG[name.toLowerCase()] ?? STEM_CONFIG["other"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (s: number) => {
    if (isNaN(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};

const alpha = (color: string, opacity: number) =>
    `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;

// ─── Styles ──────────────────────────────────────────────────────────────────

const GlobalStyles = () => (
    <style>{`
        .sep-vol::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 11px; height: 11px;
            border-radius: 50%;
            background: hsl(var(--primary));
            cursor: pointer;
            border: none;
        }
        .sep-vol::-moz-range-thumb {
            width: 11px; height: 11px;
            border-radius: 50%;
            background: hsl(var(--primary));
            cursor: pointer;
            border: none;
        }
        .sep-vol:disabled::-webkit-slider-thumb { background: hsl(var(--muted-foreground) / 0.4); }
        .sep-vol:disabled::-moz-range-thumb     { background: hsl(var(--muted-foreground) / 0.4); }
    `}</style>
);

// ─── Component ───────────────────────────────────────────────────────────────

export default function Separator() {
    const [, setLocation] = useLocation();

    const [studioData, setStudioData]         = useState<StudioData | null>(null);
    const [stems, setStems]                   = useState<StemControl[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isAudioReady, setIsAudioReady]     = useState(false);
    const [isAllPlaying, setIsAllPlaying]     = useState(false);
    const [maxDuration, setMaxDuration]       = useState(0);
    const [playbackTime, setPlaybackTime]     = useState(0);
    const [loopStart, setLoopStart]           = useState(0.01);
    const [loopEnd, setLoopEnd]               = useState(0);
    const [isLooping, setIsLooping]           = useState(false);

    const playersRef    = useRef<Map<string, Tone.Player>>(new Map());
    const volNodesRef   = useRef<Map<string, Tone.Volume>>(new Map());
    const pitchShiftRef = useRef<Map<string, Tone.PitchShift>>(new Map());
    const timelineRef   = useRef<HTMLDivElement>(null);
    const isDragging    = useRef<"start" | "end" | "playhead" | null>(null);
    const isScrubbing   = useRef(false);

    const bpm = useBpm();

    // ── 1. INIT ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const raw = localStorage.getItem("currentStudioData");
        if (!raw) { setLocation("/library"); return; }
        const data: StudioData = JSON.parse(raw);
        setStudioData(data);
        Tone.start().catch(console.error);

        const tr = Tone.getTransport();
        tr.stop(); tr.seconds = 0; tr.loop = false; (tr as any).playbackRate = 1;

        const initial: StemControl[] = data.stemNames.map(name => ({
            name, volume: 0.8, isMuted: false, isSoloed: false, hasLoadError: false,
        }));
        setStems(initial);

        (async () => {
            let maxDur = 0; let anyErr = false;
            await Promise.all(initial.map(async stem => {
                try {
                    const vol   = new Tone.Volume(Tone.gainToDb(stem.volume)).toDestination();
                    volNodesRef.current.set(stem.name, vol);

                    const pitch = new Tone.PitchShift(0).connect(vol);
                    pitchShiftRef.current.set(stem.name, pitch);
                    bpm.registerPitchShifter(stem.name, pitch);

                    const player = new Tone.Player(getStemAudioUrl(data.videoId, stem.name)).connect(pitch);
                    await Tone.loaded();
                    player.sync().start(0);
                    playersRef.current.set(stem.name, player);
                    bpm.registerPlayer(stem.name, player);

                    if (player.buffer.duration > maxDur) maxDur = player.buffer.duration;
                } catch {
                    anyErr = true;
                    setStems(p => p.map(s => s.name === stem.name ? { ...s, hasLoadError: true } : s));
                }
            }));
            setIsInitializing(false);
            if (!anyErr) { setIsAudioReady(true); setMaxDuration(maxDur); setLoopEnd(maxDur); }
        })();

        return () => {
            Tone.getTransport().stop();
            playersRef.current.forEach(p => { try { p.unsync(); p.dispose(); } catch {} });
            pitchShiftRef.current.forEach(ps => { try { ps.dispose(); } catch {} });
            volNodesRef.current.forEach(v => { try { v.dispose(); } catch {} });
            playersRef.current.clear(); pitchShiftRef.current.clear(); volNodesRef.current.clear();
        };
    }, [setLocation]); // eslint-disable-line

    // ── 2. TIME TRACKING ─────────────────────────────────────────────────────
    useEffect(() => {
        let id: number;
        const tick = () => { if (!isScrubbing.current) setPlaybackTime(Tone.getTransport().seconds); id = requestAnimationFrame(tick); };
        if (isAllPlaying) id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [isAllPlaying]);

    // ── 3. LOOP → Transport ───────────────────────────────────────────────────
    useEffect(() => {
        const tr = Tone.getTransport();
        tr.loop = isLooping && loopEnd > loopStart;
        tr.loopStart = loopStart;
        tr.loopEnd   = loopEnd;
    }, [isLooping, loopStart, loopEnd]);

    // ── 4. PLAY / PAUSE ───────────────────────────────────────────────────────
    const toggleAllPlayback = useCallback(async () => {
        if (!isAudioReady) return;
        await Tone.start();
        const tr = Tone.getTransport();
        if (isAllPlaying) { tr.pause(); setIsAllPlaying(false); }
        else              { tr.start(); setIsAllPlaying(true);  }
    }, [isAllPlaying, isAudioReady]);

    // ── 5. SEEK ───────────────────────────────────────────────────────────────
    const handleSeek = useCallback((t: number) => {
        if (!isAudioReady || maxDuration === 0) return;
        let ct = Math.max(0, Math.min(t, maxDuration));
        if (isLooping && loopEnd > loopStart && (ct < loopStart || ct >= loopEnd)) ct = loopStart;
        Tone.getTransport().seconds = ct;
        setPlaybackTime(ct);
    }, [isAudioReady, maxDuration, isLooping, loopStart, loopEnd]);

    // ── 6. LOOP TOGGLE ────────────────────────────────────────────────────────
    const toggleLoop = useCallback(() => {
        if (!isAudioReady || !maxDuration) return;
        const next = !isLooping;
        setIsLooping(next);
        if (!next) { setLoopStart(0.01); setLoopEnd(maxDuration); }
    }, [isLooping, isAudioReady, maxDuration]);

    // ── 7. REWIND / FORWARD ───────────────────────────────────────────────────
    const handleRewind  = useCallback(() => handleSeek(Math.max(0, playbackTime - 5)),                [handleSeek, playbackTime]);
    const handleForward = useCallback(() => handleSeek((playbackTime + 5) % maxDuration),             [handleSeek, playbackTime, maxDuration]);

    // ── 8. VOLUME / MUTE / SOLO ───────────────────────────────────────────────
    const applyVolumes = useCallback((next: StemControl[]) => {
        const anySoloed = next.some(s => s.isSoloed);
        next.forEach(s => {
            const n = volNodesRef.current.get(s.name); if (!n) return;
            const silent = s.isMuted || (anySoloed && !s.isSoloed);
            n.volume.value = silent ? -Infinity : Tone.gainToDb(s.volume);
        });
    }, []);

    const handleVolumeChange = useCallback((name: string, vol: number) => {
        setStems(prev => { const next = prev.map(s => s.name === name ? { ...s, volume: vol } : s); applyVolumes(next); return next; });
    }, [applyVolumes]);

    const toggleMute = useCallback((name: string) => {
        setStems(prev => { const next = prev.map(s => s.name === name ? { ...s, isMuted: !s.isMuted } : s); applyVolumes(next); return next; });
    }, [applyVolumes]);

    const toggleSolo = useCallback((name: string) => {
        setStems(prev => { const next = prev.map(s => s.name === name ? { ...s, isSoloed: !s.isSoloed } : s); applyVolumes(next); return next; });
    }, [applyVolumes]);

    // ── 9. DRAG (playhead + A/B markers) ─────────────────────────────────────
    const toTime = useCallback((x: number) => {
        if (!timelineRef.current || !maxDuration) return 0;
        const r = timelineRef.current.getBoundingClientRect();
        return Math.max(0, Math.min((x - r.left) / r.width, 1)) * maxDuration;
    }, [maxDuration]);

    const onDrag = useCallback((x: number) => {
        if (!isDragging.current) return;
        const t = toTime(x);
        if      (isDragging.current === "start")    setLoopStart(Math.max(0.01, Math.min(t, loopEnd - 0.1)));
        else if (isDragging.current === "end")      setLoopEnd(Math.min(maxDuration, Math.max(t, loopStart + 0.1)));
        else if (isDragging.current === "playhead") handleSeek(t);
    }, [toTime, loopStart, loopEnd, maxDuration, handleSeek]);

    const onDragEnd = useCallback(() => {
        if (isDragging.current === "playhead") isScrubbing.current = false;
        isDragging.current = null;
        document.removeEventListener("mousemove", mmove);
        document.removeEventListener("mouseup",   mup);
        document.removeEventListener("touchmove", tmove);
        document.removeEventListener("touchend",  tend);
    }, []); // eslint-disable-line

    const mmove = useCallback((e: MouseEvent)  => onDrag(e.clientX),                                     [onDrag]);
    const mup   = useCallback(() => onDragEnd(),                                                           [onDragEnd]);
    const tmove = useCallback((e: TouchEvent)  => { e.preventDefault(); onDrag(e.touches[0].clientX); }, [onDrag]);
    const tend  = useCallback(() => onDragEnd(),                                                           [onDragEnd]);

    const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: "start" | "end" | "playhead") => {
        e.stopPropagation();
        if ("touches" in e) e.preventDefault();
        if (type === "playhead") isScrubbing.current = true;
        isDragging.current = type;
        document.addEventListener("mousemove", mmove);
        document.addEventListener("mouseup",   mup);
        document.addEventListener("touchmove", tmove, { passive: false });
        document.addEventListener("touchend",  tend);
    }, [mmove, mup, tmove, tend]);

    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        if (!isAudioReady) return;
        handleSeek(toTime(e.clientX));
    }, [isAudioReady, handleSeek, toTime]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const pct          = maxDuration > 0 ? (playbackTime  / maxDuration) * 100 : 0;
    const loopStartPct = maxDuration > 0 ? (loopStart     / maxDuration) * 100 : 0;
    const loopEndPct   = maxDuration > 0 ? (loopEnd       / maxDuration) * 100 : 0;
    const hasLoadError = stems.some(s => s.hasLoadError);
    const anySoloed    = stems.some(s => s.isSoloed);

    const rulerTicks = (() => {
        if (!maxDuration) return [];
        const interval = maxDuration < 60 ? 5 : maxDuration < 300 ? 15 : maxDuration < 600 ? 30 : 60;
        const ticks: { t: number; p: number }[] = [];
        for (let t = 0; t <= maxDuration; t += interval) ticks.push({ t, p: (t / maxDuration) * 100 });
        return ticks;
    })();


    const primary = "hsl(var(--primary))";

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isInitializing || !isAudioReady) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <Disc3 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary/60" />
                </div>
                <p className="mt-6 text-muted-foreground text-sm tracking-widest uppercase font-mono">
                    Loading {playersRef.current.size} / {stems.length} tracks
                </p>
                {hasLoadError && <p className="mt-3 text-xs text-destructive">Some tracks failed to load</p>}
            </div>
        );
    }
    if (!studioData) return (
        <div className="p-6 text-destructive min-h-screen bg-background flex items-center justify-center">Missing studio data.</div>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col min-h-screen bg-background select-none" style={{ fontFamily: "'DM Sans','Inter',sans-serif" }}>
            <GlobalStyles />

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
                <button onClick={() => { Tone.getTransport().stop(); setLocation("/library"); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Library
                </button>
                <h1 className="text-sm font-semibold text-foreground truncate max-w-xs">{studioData.trackTitle}</h1>
                <div className="w-20" />
            </div>

            {/* ── DAW area ── */}
            <div className="flex flex-1 min-h-0">

                {/* Left sidebar */}
                <div className="shrink-0 border-r border-border/15 flex flex-col" style={{ width: 196 }}>
                    {/* Ruler row placeholder */}
                    <div className="flex items-center px-3 shrink-0"
                        style={{ height: RULER_H, borderBottom: "1px solid hsl(var(--border) / 0.15)" }}>
                        <span className="text-[10px] font-mono tabular-nums" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}>
                            {fmt(playbackTime)}
                        </span>
                    </div>

                    {/* Stem rows - fill remaining height equally */}
                    <div className="flex-1 flex flex-col min-h-0">
                    {stems.map(stem => {
                        const cfg      = getCfg(stem.name);
                        const silent   = stem.isMuted || (anySoloed && !stem.isSoloed);
                        const isActive = !silent && isAllPlaying;
                        return (
                            <div key={stem.name}
                                style={{ borderBottom: "1px solid hsl(var(--border) / 0.12)", minHeight: 0 }}
                                className="flex-1 flex flex-col justify-center px-3 gap-2">
                                {/* Icon + name */}
                                <div className="flex items-center gap-2">
                                    <span style={{ color: isActive ? primary : "hsl(var(--muted-foreground))" }} className="transition-colors">
                                        {cfg.icon}
                                    </span>
                                    <span className="text-xs font-semibold tracking-wide transition-colors"
                                        style={{ color: isActive ? primary : "hsl(var(--muted-foreground))" }}>
                                        {cfg.label}
                                    </span>
                                    {stem.hasLoadError && (
                                        <span className="text-[9px] text-destructive bg-destructive/10 px-1 rounded font-mono">ERR</span>
                                    )}
                                </div>
                                {/* M / S / volume row */}
                                <div className="flex items-center gap-1.5">
                                    {/* M */}
                                    <button
                                        onClick={() => toggleMute(stem.name)}
                                        disabled={stem.hasLoadError || !isAudioReady}
                                        className="rounded text-[10px] font-bold shrink-0 transition-all disabled:opacity-30"
                                        style={{
                                            width: 20, height: 20,
                                            background: stem.isMuted ? "hsl(var(--destructive) / 0.25)" : "hsl(var(--muted) / 0.25)",
                                            color:      stem.isMuted ? "hsl(var(--destructive))"        : "hsl(var(--muted-foreground))",
                                            border:     stem.isMuted ? "1px solid hsl(var(--destructive) / 0.5)" : "1px solid hsl(var(--border) / 0.4)",
                                        }}>
                                        M
                                    </button>
                                    {/* S */}
                                    <button
                                        onClick={() => toggleSolo(stem.name)}
                                        disabled={stem.hasLoadError || !isAudioReady}
                                        className="rounded text-[10px] font-bold shrink-0 transition-all disabled:opacity-30"
                                        style={{
                                            width: 20, height: 20,
                                            background: stem.isSoloed ? alpha(primary, 0.3) : "hsl(var(--muted) / 0.25)",
                                            color:      stem.isSoloed ? primary              : "hsl(var(--muted-foreground))",
                                            border:     stem.isSoloed ? `1px solid ${alpha(primary, 0.55)}` : "1px solid hsl(var(--border) / 0.4)",
                                        }}>
                                        S
                                    </button>
                                    {/* Volume slider */}
                                    <input type="range" min="0" max="1" step="0.01" value={stem.volume}
                                        onChange={e => handleVolumeChange(stem.name, parseFloat(e.target.value))}
                                        disabled={stem.hasLoadError || !isAudioReady}
                                        className="flex-1 h-1 appearance-none rounded-full cursor-pointer disabled:opacity-30 sep-vol"
                                        style={{
                                            WebkitAppearance: "none",
                                            background: silent
                                                ? `linear-gradient(to right, hsl(var(--muted-foreground) / 0.25) ${stem.volume * 100}%, hsl(var(--muted) / 0.15) ${stem.volume * 100}%)`
                                                : `linear-gradient(to right, ${primary} ${stem.volume * 100}%, hsl(var(--border) / 0.3) ${stem.volume * 100}%)`,
                                        } as React.CSSProperties}
                                    />
                                    <span className="text-[10px] font-mono tabular-nums shrink-0"
                                        style={{ color: "hsl(var(--muted-foreground) / 0.55)", width: 22, textAlign: "right" }}>
                                        {Math.round(stem.volume * 100)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>

                {/* Right timeline */}
                <div className="flex-1 overflow-x-hidden flex flex-col min-h-0">
                    <div
                        ref={timelineRef}
                        className="relative w-full cursor-crosshair flex-1 flex flex-col min-h-0"
                        onClick={handleTimelineClick}
                    >
                        {/* Time ruler */}
                        <div className="relative shrink-0 pointer-events-none"
                            style={{ height: RULER_H, borderBottom: "1px solid hsl(var(--border) / 0.15)", background: "hsl(var(--background))", zIndex: 5 }}>
                            {rulerTicks.map(({ t, p }) => (
                                <div key={t} className="absolute flex flex-col items-center" style={{ left: `${p}%`, transform: "translateX(-50%)" }}>
                                    <span className="text-[9px] font-mono tabular-nums whitespace-nowrap"
                                        style={{ color: "hsl(var(--muted-foreground) / 0.55)", lineHeight: "20px" }}>
                                        {fmt(t)}
                                    </span>
                                    <div className="w-px" style={{ height: 6, background: "hsl(var(--border) / 0.4)" }} />
                                </div>
                            ))}
                        </div>

                        {/* Track rows - flex-1 each, fill remaining height */}
                        {stems.map((stem) => {
                            const silent       = stem.isMuted || (anySoloed && !stem.isSoloed);
                            const baseOpacity  = silent ? 0.07 : 0.22;
                            const playedOpacity = silent ? 0.04 : 0.48;
                            return (
                                <div key={stem.name} className="flex-1 relative overflow-hidden"
                                    style={{ borderBottom: "1px solid hsl(var(--border) / 0.1)" }}>
                                    {/* Base fill */}
                                    <div className="absolute inset-0" style={{ background: alpha(primary, baseOpacity) }} />
                                    {/* Played fill */}
                                    <div className="absolute top-0 left-0 bottom-0"
                                        style={{ width: `${pct}%`, background: alpha(primary, playedOpacity), transition: "none" }} />
                                </div>
                            );
                        })}

                        {/* Loop region tint */}
                        {isLooping && loopEnd > loopStart && maxDuration > 0 && (
                            <div className="absolute top-0 bottom-0 pointer-events-none"
                                style={{
                                    left:    `${loopStartPct}%`,
                                    width:   `${loopEndPct - loopStartPct}%`,
                                    background: alpha(primary, 0.09),
                                    zIndex:  10,
                                }} />
                        )}

                        {/* A marker — cap extends RIGHTWARD from the line so it never overlaps B */}
                        {isLooping && maxDuration > 0 && (
                            <div className="absolute top-0 bottom-0 pointer-events-none"
                                style={{ left: `${loopStartPct}%`, zIndex: 22 }}>
                                {/* Vertical line */}
                                <div className="absolute top-0 bottom-0" style={{ left: 0, width: 1, background: alpha(primary, 0.75) }} />
                                {/* Cap: centered on line, at top, rounded bottom corners */}
                                <div className="pointer-events-auto absolute top-0 flex flex-col items-center justify-center cursor-ew-resize"
                                    style={{ left: 0, transform: "translateX(-50%)", paddingLeft: 6, paddingRight: 6, height: RULER_H, background: primary, borderRadius: "0 0 4px 4px", minWidth: 44 }}
                                    onMouseDown={e => onDragStart(e, "start")}
                                    onTouchStart={e => onDragStart(e, "start")}
                                    onClick={e => e.stopPropagation()}>
                                    <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1, color: "hsl(var(--primary-foreground))" }}>A</span>
                                    <span style={{ fontSize: 8, fontFamily: "monospace", lineHeight: 1.3, color: "hsl(var(--primary-foreground))", opacity: 0.88, whiteSpace: "nowrap" }}>{fmt(loopStart)}</span>
                                </div>
                            </div>
                        )}

                        {/* B marker — cap extends LEFTWARD from the line so it never overlaps A */}
                        {isLooping && maxDuration > 0 && (
                            <div className="absolute top-0 bottom-0 pointer-events-none"
                                style={{ left: `${loopEndPct}%`, zIndex: 22 }}>
                                {/* Vertical line */}
                                <div className="absolute top-0 bottom-0" style={{ left: 0, width: 1, background: alpha(primary, 0.5) }} />
                                {/* Cap: centered on line, at BOTTOM, rounded top corners */}
                                <div className="pointer-events-auto absolute bottom-0 flex flex-col items-center justify-center cursor-ew-resize"
                                    style={{ left: 0, transform: "translateX(-50%)", paddingLeft: 6, paddingRight: 6, height: RULER_H, background: alpha(primary, 0.72), borderRadius: "4px 4px 0 0", minWidth: 44 }}
                                    onMouseDown={e => onDragStart(e, "end")}
                                    onTouchStart={e => onDragStart(e, "end")}
                                    onClick={e => e.stopPropagation()}>
                                    <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1, color: "hsl(var(--primary-foreground))" }}>B</span>
                                    <span style={{ fontSize: 8, fontFamily: "monospace", lineHeight: 1.3, color: "hsl(var(--primary-foreground))", opacity: 0.88, whiteSpace: "nowrap" }}>{fmt(loopEnd)}</span>
                                </div>
                            </div>
                        )}

                        {/* Playhead */}
                        {maxDuration > 0 && (
                            <div className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                                style={{ left: `${pct}%`, zIndex: 30, transform: "translateX(-50%)" }}>
                                {/* Grip cap */}
                                <div className="pointer-events-auto rounded-full cursor-ew-resize shrink-0"
                                    style={{
                                        width: 12, height: 12,
                                        marginTop: (RULER_H - 12) / 2,
                                        background: "white",
                                        boxShadow: "0 0 0 2px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.3)",
                                    }}
                                    onMouseDown={e => onDragStart(e, "playhead")}
                                    onTouchStart={e => onDragStart(e, "playhead")}
                                    onClick={e => e.stopPropagation()} />
                                {/* Line */}
                                <div className="flex-1 w-px" style={{ background: "rgba(255,255,255,0.8)" }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Bottom transport bar ── */}
            <div className="flex items-center gap-4 px-4 shrink-0 border-t border-border/20"
                style={{ height: 64, background: "hsl(var(--card))" }}>

                {/* Song info */}
                <div className="flex items-center gap-3 shrink-0" style={{ width: 220 }}>
                    <img
                        src={`https://img.youtube.com/vi/${studioData.videoId}/default.jpg`}
                        alt=""
                        className="rounded object-cover shrink-0"
                        style={{ width: 42, height: 42 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="text-xs font-semibold text-foreground truncate leading-tight">{studioData.trackTitle}</span>
                </div>

                {/* Center: BPM + play controls + loop — all tight together */}
                <div className="flex-1 flex items-center justify-center gap-2">
                    {/* BPM */}
                    <div className="flex items-center rounded-lg border border-border/40 overflow-hidden">
                        <button onClick={() => bpm.incrementBpm(-1)}
                            disabled={!isAudioReady || !bpm.originalBpm || (bpm.currentBpm ?? 0) <= 40}
                            className="w-7 h-7 flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/20 disabled:opacity-30 transition-all border-r border-border/40">
                            −
                        </button>
                        <div className="px-2 h-7 flex items-center gap-1 min-w-[60px] justify-center">
                            <span className="text-sm font-mono font-semibold tabular-nums"
                                style={{ color: bpm.currentBpm !== bpm.originalBpm ? primary : "hsl(var(--foreground))" }}>
                                {bpm.currentBpm ?? "--"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">BPM</span>
                        </div>
                        <button onClick={() => bpm.incrementBpm(+1)}
                            disabled={!isAudioReady || !bpm.originalBpm || bpm.currentBpm === bpm.originalBpm}
                            className="w-7 h-7 flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/20 disabled:opacity-30 transition-all border-l border-border/40">
                            +
                        </button>
                    </div>
                    {bpm.currentBpm !== bpm.originalBpm && bpm.originalBpm && (
                        <button onClick={bpm.resetBpm}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary transition-all"
                            title={`Reset to ${bpm.originalBpm} BPM`}>
                            <RotateCcw className="w-3 h-3" />
                        </button>
                    )}

                    {/* Divider */}
                    <div className="w-px h-5 bg-border/30 mx-1" />

                    {/* Playback */}
                    <button onClick={handleRewind} disabled={!isAudioReady || hasLoadError}
                        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button onClick={toggleAllPlayback} disabled={!isAudioReady || hasLoadError}
                        className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25 transition-all active:scale-95 disabled:opacity-40">
                        {isAllPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <button onClick={handleForward} disabled={!isAudioReady || hasLoadError}
                        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                    </button>

                    {/* Divider */}
                    <div className="w-px h-5 bg-border/30 mx-1" />

                    {/* Loop */}
                    <button onClick={toggleLoop} disabled={!isAudioReady}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
                            isLooping
                                ? "text-primary bg-primary/15"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/15"}`}>
                        <Repeat2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Right spacer balances the song info width */}
                <div style={{ width: 220 }} />
            </div>
        </div>
    );
}
