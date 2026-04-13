import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import * as Tone from "tone";
import {
    Music, Zap, Volume2, Disc3, Aperture, ArrowLeft, Play, Pause,
    X, ArrowRight, Repeat2, ChevronUp, ChevronDown, RotateCcw
} from "lucide-react";

// --- UI Components ---
interface ButtonProps {
    children?: ReactNode; onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string; variant?: string; disabled?: boolean; size?: string;
}
const Button = ({ children, onClick, className, variant = "default", disabled = false, size = "default" }: ButtonProps) => {
    const base = "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 focus:outline-none active:scale-95";
    const sz   = size === 'icon' ? 'h-10 w-10 p-2' : size === 'sm' ? 'h-8 px-3 py-1 text-xs' : 'h-10 px-4 py-2';
    const vars: Record<string,string> = {
        outline:   'bg-transparent border border-white/10 text-gray-300 hover:bg-white/5',
        secondary: 'bg-white/5 text-gray-200 hover:bg-white/10 border border-white/5',
        danger:    'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30',
        ghost:     'bg-transparent text-gray-400 hover:text-white hover:bg-white/5',
        default:   'bg-amber-500 text-black hover:bg-amber-400 font-semibold shadow-lg shadow-amber-500/20',
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`${base} ${sz} ${vars[variant] ?? vars.default} ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''} ${className}`}>
            {children}
        </button>
    );
};

// --- Types ---
interface StudioData { videoId: string; trackTitle: string; stemNames: string[]; }
interface StemControl { name: string; volume: number; isMuted: boolean; hasLoadError: boolean; }

const API_BASE_URL = "http://localhost:8081";
const getStemAudioUrl = (videoId: string, stemName: string) =>
    `${API_BASE_URL}/api/audio/serve/track?videoId=${videoId}&trackName=${stemName}`;

const formatTime = (s: number) => {
    if (isNaN(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
};

const STEM_CONFIG: Record<string,{color:string;icon:ReactNode;label:string}> = {
    vocals: { color:'#f87171', icon:<Music    className="w-4 h-4"/>, label:'Vocals' },
    drums:  { color:'#60a5fa', icon:<Disc3    className="w-4 h-4"/>, label:'Drums'  },
    drum:   { color:'#60a5fa', icon:<Disc3    className="w-4 h-4"/>, label:'Drums'  },
    bass:   { color:'#34d399', icon:<Aperture className="w-4 h-4"/>, label:'Bass'   },
    other:  { color:'#fbbf24', icon:<Zap      className="w-4 h-4"/>, label:'Other'  },
};
const getCfg = (name: string) => STEM_CONFIG[name.toLowerCase()] ?? STEM_CONFIG['other'];

// ─────────────────────────────────────────────────────────────────────────────
export default function Separator() {
    const [, setLocation] = useLocation();

    const [studioData, setStudioData]         = useState<StudioData|null>(null);
    const [stems, setStems]                   = useState<StemControl[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isAudioReady, setIsAudioReady]     = useState(false);
    const [isAllPlaying, setIsAllPlaying]     = useState(false);
    const [maxDuration, setMaxDuration]       = useState(0);
    const [playbackTime, setPlaybackTime]     = useState(0);
    const [loopStart, setLoopStart]           = useState(0.01);
    const [loopEnd, setLoopEnd]               = useState(0);
    const [isLooping, setIsLooping]           = useState(false);
    const [tempo, setTempo]                   = useState(100);

    const playersRef  = useRef<Map<string,Tone.Player>>(new Map());
    const volNodesRef = useRef<Map<string,Tone.Volume>>(new Map());
    const seekBarRef  = useRef<HTMLDivElement>(null);
    const isDragging  = useRef<'start'|'end'|null>(null);

    // 1. INIT ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        const raw = localStorage.getItem('currentStudioData');
        if (!raw) { setLocation('/library'); return; }
        const data: StudioData = JSON.parse(raw);
        setStudioData(data);
        Tone.start().catch(console.error);

        const tr = Tone.getTransport();
        tr.stop(); tr.seconds = 0; tr.loop = false;

        const initial: StemControl[] = data.stemNames.map(name => ({
            name, volume: 0.8, isMuted: false, hasLoadError: false,
        }));
        setStems(initial);

        (async () => {
            let maxDur = 0; let anyErr = false;
            await Promise.all(initial.map(async stem => {
                try {
                    const vol = new Tone.Volume(Tone.gainToDb(stem.volume)).toDestination();
                    volNodesRef.current.set(stem.name, vol);
                    const player = new Tone.Player(getStemAudioUrl(data.videoId, stem.name)).connect(vol);
                    await Tone.loaded();
                    player.sync().start(0);
                    playersRef.current.set(stem.name, player);
                    if (player.buffer.duration > maxDur) maxDur = player.buffer.duration;
                } catch {
                    anyErr = true;
                    setStems(p => p.map(s => s.name === stem.name ? {...s, hasLoadError:true} : s));
                }
            }));
            setIsInitializing(false);
            if (!anyErr) { setIsAudioReady(true); setMaxDuration(maxDur); setLoopEnd(maxDur); }
        })();

        return () => {
            Tone.getTransport().stop();
            playersRef.current.forEach(p => { try { p.unsync(); p.dispose(); } catch {} });
            volNodesRef.current.forEach(v => { try { v.dispose(); } catch {} });
            playersRef.current.clear(); volNodesRef.current.clear();
        };
    }, [setLocation]);

    // 2. TIME TRACKING ────────────────────────────────────────────────────────
    useEffect(() => {
        let id: number;
        const tick = () => { setPlaybackTime(Tone.getTransport().seconds); id = requestAnimationFrame(tick); };
        if (isAllPlaying) id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [isAllPlaying]);

    // 3. LOOP → Transport (one effect, always in sync) ─────────────────────
    useEffect(() => {
        const tr = Tone.getTransport();
        tr.loop      = isLooping && loopEnd > loopStart;
        tr.loopStart = loopStart;
        tr.loopEnd   = loopEnd;
    }, [isLooping, loopStart, loopEnd]);

    // 4. TEMPO ────────────────────────────────────────────────────────────────
    useEffect(() => { Tone.getTransport().bpm.value = tempo; }, [tempo]);

    // 5. PLAY / PAUSE ─────────────────────────────────────────────────────────
    const toggleAllPlayback = useCallback(async () => {
        if (!isAudioReady) return;
        await Tone.start();
        const tr = Tone.getTransport();
        if (isAllPlaying) { tr.pause(); setIsAllPlaying(false); }
        else              { tr.start(); setIsAllPlaying(true);  }
    }, [isAllPlaying, isAudioReady]);

    // 6. SEEK ─────────────────────────────────────────────────────────────────
    const handleSeek = useCallback((t: number) => {
        if (!isAudioReady || maxDuration === 0) return;
        let ct = Math.max(0, Math.min(t, maxDuration));
        if (isLooping && loopEnd > loopStart && (ct < loopStart || ct >= loopEnd)) ct = loopStart;
        Tone.getTransport().seconds = ct;
        setPlaybackTime(ct);
    }, [isAudioReady, maxDuration, isLooping, loopStart, loopEnd]);

    // 7. LOOP TOGGLE ──────────────────────────────────────────────────────────
    const toggleLoop = useCallback(() => {
        if (!isAudioReady || !maxDuration) return;
        const next = !isLooping;
        setIsLooping(next);
        if (!next) { setLoopStart(0.01); setLoopEnd(maxDuration); }
    }, [isLooping, isAudioReady, maxDuration]);

    // 8. REWIND / FORWARD ─────────────────────────────────────────────────────
    const handleRewind  = useCallback(() => handleSeek(Math.max(0, playbackTime - 5)),     [handleSeek, playbackTime]);
    const handleForward = useCallback(() => handleSeek((playbackTime + 5) % maxDuration),  [handleSeek, playbackTime, maxDuration]);

    // 9. TEMPO ────────────────────────────────────────────────────────────────
    const handleTempoChange = useCallback((v: number) => setTempo(Math.max(50, Math.min(200, v))), []);

    // 10. VOLUME / MUTE ───────────────────────────────────────────────────────
    const handleVolumeChange = useCallback((name: string, vol: number) => {
        setStems(p => p.map(s => s.name === name ? {...s, volume:vol} : s));
        const n = volNodesRef.current.get(name);
        if (n) n.volume.value = vol === 0 ? -Infinity : Tone.gainToDb(vol);
    }, []);

    const toggleMute = useCallback((name: string) => {
        setStems(p => p.map(s => {
            if (s.name !== name) return s;
            const m = !s.isMuted;
            const n = volNodesRef.current.get(name);
            if (n) n.volume.value = m ? -Infinity : Tone.gainToDb(s.volume);
            return {...s, isMuted: m};
        }));
    }, []);

    // 11. A-B DRAG ────────────────────────────────────────────────────────────
    const toTime = useCallback((x: number) => {
        if (!seekBarRef.current || !maxDuration) return 0;
        const r = seekBarRef.current.getBoundingClientRect();
        return Math.max(0, Math.min((x - r.left) / r.width, 1)) * maxDuration;
    }, [maxDuration]);

    const onDrag = useCallback((x: number) => {
        if (!isDragging.current) return;
        const t = toTime(x);
        if (isDragging.current === 'start') setLoopStart(Math.max(0.01, Math.min(t, loopEnd - 0.1)));
        else                                 setLoopEnd(Math.min(maxDuration, Math.max(t, loopStart + 0.1)));
    }, [toTime, loopStart, loopEnd, maxDuration]);

    const onDragEnd = useCallback(() => {
        isDragging.current = null;
        document.removeEventListener('mousemove', mmove);
        document.removeEventListener('mouseup',   mup);
        document.removeEventListener('touchmove', tmove);
        document.removeEventListener('touchend',  tend);
    }, []); // eslint-disable-line

    const mmove  = useCallback((e: MouseEvent)  => onDrag(e.clientX),                                      [onDrag]);
    const mup    = useCallback(() => onDragEnd(),                                                            [onDragEnd]);
    const tmove  = useCallback((e: TouchEvent)  => { e.preventDefault(); onDrag(e.touches[0].clientX); },  [onDrag]);
    const tend   = useCallback(() => onDragEnd(),                                                            [onDragEnd]);

    const onDragStart = useCallback((e: React.MouseEvent|React.TouchEvent, type: 'start'|'end') => {
        if ('touches' in e) e.preventDefault();
        isDragging.current = type;
        document.addEventListener('mousemove', mmove);
        document.addEventListener('mouseup',   mup);
        document.addEventListener('touchmove', tmove, { passive: false });
        document.addEventListener('touchend',  tend);
    }, [mmove, mup, tmove, tend]);

    // ── DERIVED ───────────────────────────────────────────────────────────────
    const pct          = maxDuration > 0 ? (playbackTime / maxDuration) * 100 : 0;
    const hasLoadError = stems.some(s => s.hasLoadError);

    // ── LOADING SCREEN ────────────────────────────────────────────────────────
    if (isInitializing || !isAudioReady) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0c0e]">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                    <Disc3 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-amber-500/60" />
                </div>
                <p className="mt-6 text-gray-400 text-sm tracking-widest uppercase font-mono">
                    Loading {playersRef.current.size} / {stems.length} tracks
                </p>
                {hasLoadError && <p className="mt-3 text-xs text-red-400 flex items-center gap-1"><X className="w-3 h-3"/> Some tracks failed</p>}
            </div>
        );
    }
    if (!studioData) return <div className="p-6 text-red-400 min-h-screen bg-[#0c0c0e] flex items-center justify-center">Missing studio data.</div>;

    return (
        <div className="min-h-screen bg-[#0c0c0e] p-4 sm:p-8" style={{fontFamily:"'DM Sans','Inter',sans-serif"}}>
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Button variant="ghost" onClick={() => { Tone.getTransport().stop(); setLocation('/library'); }} className="text-gray-400 hover:text-white gap-2">
                        <ArrowLeft className="w-4 h-4"/><span className="text-sm">Library</span>
                    </Button>
                    <div className="text-center">
                        <p className="text-xs text-amber-500 tracking-[0.2em] uppercase font-mono mb-1">Now Editing</p>
                        <h1 className="text-lg font-semibold text-white truncate max-w-[260px]">{studioData.trackTitle}</h1>
                    </div>
                    <div className="w-24"/>
                </div>

                {/* Player bar */}
                <div className="mb-4 p-5 rounded-2xl bg-[#141416] border border-white/5 shadow-2xl">

                    {/* Seek bar */}
                    <div className="flex items-center gap-3 mb-5">
                        <span className="text-xs font-mono text-gray-500 w-10 text-right tabular-nums">{formatTime(playbackTime)}</span>
                        <div className="flex-1 relative h-1.5 flex items-center" ref={seekBarRef}>
                            <div className="absolute inset-0 h-1.5 bg-white/8 rounded-full"/>
                            {isLooping && loopEnd > loopStart && (
                                <div className="absolute h-1.5 bg-amber-500/30 z-0 rounded-full"
                                    style={{left:`${(loopStart/maxDuration)*100}%`, width:`${((loopEnd-loopStart)/maxDuration)*100}%`}}/>
                            )}
                            <input type="range" min="0" max={maxDuration} step="0.01" value={playbackTime}
                                onChange={e => setPlaybackTime(parseFloat(e.target.value))}
                                onMouseUp={e => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
                                onTouchEnd={e => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
                                disabled={!isAudioReady || hasLoadError}
                                className="appearance-none h-1.5 rounded-full w-full relative z-10 cursor-pointer"
                                style={{WebkitAppearance:'none', background:`linear-gradient(to right,#f59e0b ${pct}%,transparent ${pct}%)`} as React.CSSProperties}
                            />
                            {isLooping && maxDuration > 0 && (<>
                                <div className="absolute top-1/2 -translate-y-1/2 z-20 cursor-ew-resize touch-none"
                                    style={{left:`${(loopStart/maxDuration)*100}%`, transform:'translateX(-50%)'}}
                                    onMouseDown={e => onDragStart(e,'start')} onTouchStart={e => onDragStart(e,'start')}>
                                    <div className="w-1.5 h-4 bg-amber-400 rounded-full shadow-lg shadow-amber-400/30"/>
                                </div>
                                <div className="absolute top-1/2 -translate-y-1/2 z-20 cursor-ew-resize touch-none"
                                    style={{left:`${(loopEnd/maxDuration)*100}%`, transform:'translateX(-50%)'}}
                                    onMouseDown={e => onDragStart(e,'end')} onTouchStart={e => onDragStart(e,'end')}>
                                    <div className="w-1.5 h-4 bg-amber-400 rounded-full shadow-lg shadow-amber-400/30"/>
                                </div>
                            </>)}
                        </div>
                        <span className="text-xs font-mono text-gray-500 w-10 text-left tabular-nums">-{formatTime(maxDuration-playbackTime)}</span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        {/* Loop */}
                        <div className="flex w-1/3">
                            <button onClick={toggleLoop} disabled={!isAudioReady}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    isLooping ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-transparent border-white/10 text-gray-500 hover:text-gray-300'}`}>
                                <Repeat2 className="w-3.5 h-3.5"/>Loop
                            </button>
                        </div>
                        {/* Transport */}
                        <div className="flex items-center gap-3 justify-center w-1/3">
                            <button onClick={handleRewind} disabled={!isAudioReady||hasLoadError} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ArrowLeft className="w-4 h-4"/></button>
                            <button onClick={toggleAllPlayback} disabled={!isAudioReady||hasLoadError}
                                className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 transition-all active:scale-95 disabled:opacity-40">
                                {isAllPlaying ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5 ml-0.5"/>}
                            </button>
                            <button onClick={handleForward} disabled={!isAudioReady||hasLoadError} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ArrowRight className="w-4 h-4"/></button>
                        </div>
                        {/* Tempo */}
                        <div className="flex items-center justify-end gap-1 w-1/3">
                            <span className="text-xs text-gray-500 font-mono mr-1">BPM</span>
                            <button onClick={() => handleTempoChange(tempo-5)} disabled={!isAudioReady||tempo<=50} className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5"/></button>
                            <span className={`text-sm font-mono font-semibold tabular-nums w-8 text-center ${tempo!==100?'text-amber-400':'text-white'}`}>{tempo}</span>
                            <button onClick={() => handleTempoChange(tempo+5)} disabled={!isAudioReady||tempo>=200} className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5"/></button>
                            {tempo!==100 && <button onClick={() => handleTempoChange(100)} className="w-5 h-5 rounded text-gray-500 hover:text-amber-400 ml-0.5"><RotateCcw className="w-3 h-3"/></button>}
                        </div>
                    </div>
                </div>

                {/* A-B controls */}
                {isLooping && (
                    <div className="mb-4 p-4 rounded-2xl bg-[#141416] border border-amber-500/15">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-amber-500 font-mono tracking-widest uppercase">A–B Loop</span>
                            <div className="flex gap-2">
                                <button onClick={() => setLoopStart(Math.max(0.01, playbackTime))}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono hover:bg-blue-500/20">
                                    <span className="font-bold">A</span>
                                    <span className="text-blue-300/70">{formatTime(loopStart)}</span>
                                </button>
                                <button onClick={() => setLoopEnd(Math.min(maxDuration, playbackTime))}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono hover:bg-rose-500/20">
                                    <span className="font-bold">B</span>
                                    <span className="text-rose-300/70">{formatTime(loopEnd)}</span>
                                </button>
                            </div>
                        </div>
                        {loopStart >= loopEnd && <p className="mt-3 text-xs text-red-400 text-center">⚠ Point A must be before point B</p>}
                    </div>
                )}

                {/* Stem tracks */}
                <div className="space-y-3">
                    {stems.map(stem => {
                        const cfg = getCfg(stem.name);
                        const active = !stem.isMuted && isAllPlaying;
                        return (
                            <div key={stem.name} className="p-4 rounded-2xl border transition-all duration-300"
                                style={{backgroundColor:'#141416', borderColor:active?`${cfg.color}30`:'rgba(255,255,255,0.05)', boxShadow:active?`0 0 20px ${cfg.color}10`:'none'}}>
                                <div className="flex items-center gap-4">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                        style={{backgroundColor:active?`${cfg.color}20`:'rgba(255,255,255,0.05)', color:active?cfg.color:'#6b7280'}}>
                                        {cfg.icon}
                                    </div>
                                    <span className="text-sm font-semibold w-16 shrink-0" style={{color:active?cfg.color:'#9ca3af'}}>{cfg.label}</span>
                                    {stem.hasLoadError && <span className="px-2 py-0.5 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-md shrink-0">ERR</span>}
                                    <div className="flex items-center gap-3 flex-1">
                                        <button onClick={() => toggleMute(stem.name)} disabled={stem.hasLoadError||!isAudioReady}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all border disabled:opacity-30 ${stem.isMuted?'bg-red-500/20 text-red-400 border-red-500/30':'bg-white/5 text-gray-400 hover:text-white border-white/5'}`}>
                                            <Volume2 className="w-3.5 h-3.5"/>
                                        </button>
                                        <input type="range" min="0" max="1" step="0.01" value={stem.volume}
                                            onChange={e => handleVolumeChange(stem.name, parseFloat(e.target.value))}
                                            disabled={stem.hasLoadError||!isAudioReady}
                                            className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer disabled:opacity-30"
                                            style={{WebkitAppearance:'none', background:stem.isMuted
                                                ? `linear-gradient(to right,rgba(255,255,255,0.15) ${stem.volume*100}%,rgba(255,255,255,0.05) ${stem.volume*100}%)`
                                                : `linear-gradient(to right,${cfg.color} ${stem.volume*100}%,rgba(255,255,255,0.07) ${stem.volume*100}%)`} as React.CSSProperties}
                                        />
                                        <span className="text-xs font-mono tabular-nums w-8 text-right shrink-0" style={{color:stem.isMuted?'#4b5563':'#6b7280'}}>
                                            {Math.round(stem.volume*100)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="text-center text-xs text-gray-600 mt-8 font-mono tracking-wider">
                    {tempo!==100?`TEMPO ${tempo}% · `:''}{stems.length} TRACKS · {formatTime(maxDuration)}
                </p>

            </div>
        </div>
    );
}