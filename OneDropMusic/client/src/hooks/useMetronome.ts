import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';

export interface MetronomeHook {
    isEnabled:        boolean;
    bpm:              number;             // own BPM, independent of any page
    volume:           number;             // 0-1
    timeSignature:    number;             // beats per bar (2,3,4,5,6)
    accentFirstBeat:  boolean;
    currentBeat:      number;             // 0-indexed, for visual indicator
    toggle:           () => void;
    setBpm:           (n: number) => void;
    setVolume:        (v: number) => void;
    setTimeSignature: (n: number) => void;
    setAccentFirstBeat: (v: boolean) => void;
}

const DEFAULT_BPM = 120;

/**
 * Fully standalone metronome — completely decoupled from Tone.Transport.
 *
 * Uses its own Tone.Clock running at (bpm / 60) Hz, so it never interferes
 * with the Separator page's Transport (used for song playback / looping /
 * BPM time-stretch). Lives in the navbar, works on any page, with its own
 * BPM that the user sets manually.
 */
export function useMetronome(): MetronomeHook {
    const [isEnabled, setIsEnabled]               = useState(false);
    const [bpm, setBpmState]                      = useState(DEFAULT_BPM);
    const [volume, setVolumeState]                = useState(0.5);
    const [timeSignature, setTimeSignatureState]  = useState(4);
    const [accentFirstBeat, setAccentFirstBeat]   = useState(true);
    const [currentBeat, setCurrentBeat]           = useState(0);

    const synthRef = useRef<Tone.MembraneSynth | null>(null);
    const clockRef = useRef<Tone.Clock | null>(null);
    const beatRef  = useRef(0);

    // Refs so the Clock callback (created once) always reads fresh values
    const accentRef = useRef(accentFirstBeat);
    const sigRef    = useRef(timeSignature);
    accentRef.current = accentFirstBeat;
    sigRef.current    = timeSignature;

    // ── Init synth + clock once ───────────────────────────────────────────
    useEffect(() => {
        const synth = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 1,
            envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
        }).toDestination();
        synth.volume.value = Tone.gainToDb(volume);
        synthRef.current = synth;

        // Independent clock — NOT tied to Tone.Transport.
        // frequency = beats per second = bpm / 60
        const clock = new Tone.Clock((time) => {
            const beat = beatRef.current % sigRef.current;
            const isAccent = beat === 0 && accentRef.current;

            synth.triggerAttackRelease(
                isAccent ? "C5" : "C6",
                "32n",
                time,
                isAccent ? 1 : 0.6
            );

            Tone.Draw.schedule(() => setCurrentBeat(beat), time);
            beatRef.current += 1;
        }, DEFAULT_BPM / 60);

        clockRef.current = clock;

        return () => {
            clock.dispose();
            synth.dispose();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── BPM → clock frequency ──────────────────────────────────────────────
    useEffect(() => {
        if (clockRef.current) {
            clockRef.current.frequency.value = bpm / 60;
        }
    }, [bpm]);

    // ── Volume ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (synthRef.current) {
            synthRef.current.volume.value = volume === 0 ? -Infinity : Tone.gainToDb(volume);
        }
    }, [volume]);

    // ── Enable / disable ────────────────────────────────────────────────────
    const toggle = useCallback(async () => {
        await Tone.start(); // ensure AudioContext is running (user gesture)
        setIsEnabled(prev => {
            const next = !prev;
            const clock = clockRef.current;
            if (!clock) return next;

            if (next) {
                beatRef.current = 0;
                clock.start();
            } else {
                clock.stop();
                setCurrentBeat(0);
            }
            return next;
        });
    }, []);

    const setBpm = useCallback((n: number) => setBpmState(Math.max(30, Math.min(300, Math.round(n)))), []);
    const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
    const setTimeSignature = useCallback((n: number) => {
        setTimeSignatureState(n);
        beatRef.current = 0; // reset bar position when signature changes
    }, []);

    return {
        isEnabled, bpm, volume, timeSignature, accentFirstBeat, currentBeat,
        toggle, setBpm, setVolume, setTimeSignature, setAccentFirstBeat,
    };
}