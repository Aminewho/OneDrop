import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';

export interface MetronomeHook {
    isEnabled:        boolean;
    volume:           number;            // 0-1
    timeSignature:    number;            // beats per bar (2,3,4,5,6)
    accentFirstBeat:  boolean;
    currentBeat:      number;            // 0-indexed, for visual indicator
    toggle:           () => void;
    setVolume:        (v: number) => void;
    setTimeSignature: (n: number) => void;
    setAccentFirstBeat: (v: boolean) => void;
}

/**
 * Standalone metronome driven by Tone.Transport.
 *
 * Runs independently of the stem players — uses Transport.bpm so the click
 * follows whatever BPM is currently set (pass bpm.currentBpm in).
 * Ticks are scheduled on quarter notes via Tone.Loop, synced to Transport
 * so the metronome starts/stops/seeks together with playback.
 */
export function useMetronome(currentBpm: number | null): MetronomeHook {
    const [isEnabled, setIsEnabled]             = useState(false);
    const [volume, setVolumeState]              = useState(0.5);
    const [timeSignature, setTimeSignatureState] = useState(4);
    const [accentFirstBeat, setAccentFirstBeat] = useState(true);
    const [currentBeat, setCurrentBeat]         = useState(0);

    const synthRef = useRef<Tone.MembraneSynth | null>(null);
    const loopRef  = useRef<Tone.Loop | null>(null);
    const beatRef  = useRef(0);

    // Keep latest settings in refs so the Tone.Loop callback (created once)
    // always reads current values without needing to be recreated.
    const accentRef = useRef(accentFirstBeat);
    const sigRef    = useRef(timeSignature);
    accentRef.current = accentFirstBeat;
    sigRef.current    = timeSignature;

    // ── Init synth + loop once ────────────────────────────────────────────
    useEffect(() => {
        const synth = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
        }).toDestination();
        synth.volume.value = Tone.gainToDb(volume);
        synthRef.current = synth;

        const loop = new Tone.Loop((time) => {
            const beat = beatRef.current % sigRef.current;
            const isAccent = beat === 0 && accentRef.current;

            synth.triggerAttackRelease(
                isAccent ? "C3" : "C2",
                "32n",
                time,
                isAccent ? 1 : 0.6
            );

            // Update visual indicator on the next animation frame
            Tone.Draw.schedule(() => setCurrentBeat(beat), time);

            beatRef.current += 1;
        }, "4n"); // quarter note

        loopRef.current = loop;

        return () => {
            loop.dispose();
            synth.dispose();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Sync Transport BPM with the song's current BPM ────────────────────
    useEffect(() => {
        if (currentBpm) {
            Tone.getTransport().bpm.value = currentBpm;
        }
    }, [currentBpm]);

    // ── Volume ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (synthRef.current) {
            synthRef.current.volume.value = volume === 0 ? -Infinity : Tone.gainToDb(volume);
        }
    }, [volume]);

    // ── Enable / disable ────────────────────────────────────────────────────
    const toggle = useCallback(() => {
        setIsEnabled(prev => {
            const next = !prev;
            const loop = loopRef.current;
            if (!loop) return next;

            if (next) {
                beatRef.current = 0;
                loop.start(0);
            } else {
                loop.stop(0);
                setCurrentBeat(0);
            }
            return next;
        });
    }, []);

    const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
    const setTimeSignature = useCallback((n: number) => {
        setTimeSignatureState(n);
        beatRef.current = 0; // reset bar position when signature changes
    }, []);

    return {
        isEnabled, volume, timeSignature, accentFirstBeat, currentBeat,
        toggle, setVolume, setTimeSignature, setAccentFirstBeat,
    };
}
