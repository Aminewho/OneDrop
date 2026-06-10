import { useState, useRef, useEffect } from "react";
import { Music2 } from "lucide-react";
import type { MetronomeHook } from "../hooks/useMetronome";

interface MetronomeControlProps {
    metronome: MetronomeHook;
    disabled?: boolean;
}

const TIME_SIGNATURES = [2, 3, 4, 5, 6];

/**
 * Metronome button + settings popover for the navbar.
 * - Click the icon to toggle the metronome on/off
 * - Click the chevron / long area to open settings (volume, time signature, accent)
 * - Beat indicator dots pulse in sync with the click
 */
export default function MetronomeControl({ metronome, disabled }: MetronomeControlProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close popover on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <div className={`flex items-center gap-1 rounded-lg border transition-all ${
                metronome.isEnabled
                    ? "bg-primary/15 border-primary/40"
                    : "bg-transparent border-border/40"
            }`}>
                {/* Toggle button */}
                <button
                    onClick={metronome.toggle}
                    disabled={disabled}
                    title={metronome.isEnabled ? "Stop metronome" : "Start metronome"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        metronome.isEnabled ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Music2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Metronome</span>

                    {/* Beat indicator dots */}
                    <span className="flex items-center gap-0.5 ml-0.5">
                        {Array.from({ length: metronome.timeSignature }).map((_, i) => (
                            <span
                                key={i}
                                className="rounded-full transition-all duration-75"
                                style={{
                                    width: i === 0 ? 6 : 4,
                                    height: i === 0 ? 6 : 4,
                                    backgroundColor: metronome.isEnabled && metronome.currentBeat === i
                                        ? "hsl(var(--primary))"
                                        : "hsl(var(--muted-foreground) / 0.3)",
                                    transform: metronome.isEnabled && metronome.currentBeat === i ? "scale(1.4)" : "scale(1)",
                                }}
                            />
                        ))}
                    </span>
                </button>

                {/* Settings toggle */}
                <button
                    onClick={() => setIsOpen(o => !o)}
                    disabled={disabled}
                    title="Metronome settings"
                    className="px-2 py-1.5 rounded-r-lg border-l border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all disabled:opacity-30"
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>

            {/* Settings popover */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-border/40 bg-card shadow-xl p-4 space-y-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">

                    {/* Volume */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">Click volume</label>
                            <span className="text-xs font-mono tabular-nums text-foreground">
                                {Math.round(metronome.volume * 100)}
                            </span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.01"
                            value={metronome.volume}
                            onChange={e => metronome.setVolume(parseFloat(e.target.value))}
                            className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                            style={{
                                background: `linear-gradient(to right, hsl(var(--primary)) ${metronome.volume * 100}%, hsl(var(--border) / 0.3) ${metronome.volume * 100}%)`
                            }}
                        />
                    </div>

                    {/* Time signature */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Time signature</label>
                        <div className="flex gap-1.5">
                            {TIME_SIGNATURES.map(n => (
                                <button
                                    key={n}
                                    onClick={() => metronome.setTimeSignature(n)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                                        metronome.timeSignature === n
                                            ? "bg-primary/15 border-primary/40 text-primary"
                                            : "bg-transparent border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/20"
                                    }`}
                                >
                                    {n}/4
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Accent first beat */}
                    <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            Accent first beat
                        </span>
                        <button
                            onClick={() => metronome.setAccentFirstBeat(!metronome.accentFirstBeat)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${
                                metronome.accentFirstBeat ? "bg-primary" : "bg-muted/40"
                            }`}
                        >
                            <span
                                className="absolute top-0.5 w-4 h-4 rounded-full bg-card shadow-sm transition-transform"
                                style={{ transform: metronome.accentFirstBeat ? "translateX(18px)" : "translateX(2px)" }}
                            />
                        </button>
                    </label>
                </div>
            )}
        </div>
    );
}
