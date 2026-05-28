import { useState, useCallback, useRef } from 'react';
import * as Tone from 'tone';

export interface BpmHook {
    originalBpm:  number | null;
    currentBpm:   number | null;
    hasError:     boolean;
    changeBpm:    (bpm: number) => void;
    incrementBpm: (delta: number) => void;
    resetBpm:     () => void;
    registerPitchShifter:   (name: string, node: Tone.PitchShift) => void;
    unregisterPitchShifter: (name: string) => void;
    registerPlayer:         (name: string, player: Tone.Player) => void;
    unregisterPlayer:       (name: string) => void;
}

export function useBpm(): BpmHook {
    const [originalBpm] = useState<number | null>(() => {
        try {
            const raw = localStorage.getItem('currentStudioData');
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data.bpm && data.bpm > 0
                ? Math.round(data.bpm * 10) / 10
                : null;
        } catch { return null; }
    });

    const [currentBpm, setCurrentBpm] = useState<number | null>(originalBpm);

    // Both maps live as refs — no re-render needed when nodes are registered
    const pitchShifters = useRef<Map<string, Tone.PitchShift>>(new Map());
    const players       = useRef<Map<string, Tone.Player>>(new Map());

    // ─────────────────────────────────────────────────────────────────────────
    // HOW TIME-STRETCH WITHOUT PITCH CHANGE WORKS:
    //
    //  Step 1: player.playbackRate = newBpm / originalBpm
    //          → audio plays faster/slower BUT pitch shifts proportionally
    //
    //  Step 2: pitchShift.pitch = -12 * log2(ratio)
    //          → cancels the unwanted pitch shift from step 1
    //
    //  Net result: tempo changes, pitch stays original = true time-stretch.
    //
    //  NOTE: Transport.playbackRate does NOT affect Player audio speed —
    //        it only affects event scheduling. We must set it per-Player.
    // ─────────────────────────────────────────────────────────────────────────
    const applyBpm = useCallback((newBpm: number, origBpm: number) => {
        const ratio     = newBpm / origBpm;
        const semitones = -12 * Math.log2(ratio);

        // Step 1 — speed up / slow down every player
        players.current.forEach(player => {
            player.playbackRate = ratio;
        });

        // Step 2 — cancel the resulting pitch shift
        pitchShifters.current.forEach(node => {
            node.pitch = semitones;
        });
    }, []);

    const changeBpm = useCallback((newBpm: number) => {
        if (!originalBpm) return;
        const clamped = Math.max(40, Math.min(300, Math.round(newBpm * 10) / 10));
        setCurrentBpm(clamped);
        applyBpm(clamped, originalBpm);
    }, [originalBpm, applyBpm]);

    const incrementBpm = useCallback((delta: number) => {
        if (!originalBpm) return;
        setCurrentBpm(prev => {
            if (prev === null) return prev;
            const next = Math.max(40, Math.min(300, Math.round((prev + delta) * 10) / 10));
            applyBpm(next, originalBpm);
            return next;
        });
    }, [originalBpm, applyBpm]);

    const resetBpm = useCallback(() => {
        if (!originalBpm) return;
        setCurrentBpm(originalBpm);
        players.current.forEach(player => { player.playbackRate = 1; });
        pitchShifters.current.forEach(node => { node.pitch = 0; });
    }, [originalBpm]);

    const registerPitchShifter   = useCallback((name: string, node: Tone.PitchShift) => {
        pitchShifters.current.set(name, node);
    }, []);
    const unregisterPitchShifter = useCallback((name: string) => {
        pitchShifters.current.delete(name);
    }, []);

    const registerPlayer   = useCallback((name: string, player: Tone.Player) => {
        players.current.set(name, player);
    }, []);
    const unregisterPlayer = useCallback((name: string) => {
        players.current.delete(name);
    }, []);

    return {
        originalBpm,
        currentBpm,
        hasError: originalBpm === null,
        changeBpm,
        incrementBpm,
        resetBpm,
        registerPitchShifter,
        unregisterPitchShifter,
        registerPlayer,
        unregisterPlayer,
    };
}
