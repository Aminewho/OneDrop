package com.music.OneDrop.Service;

import org.springframework.stereotype.Service;
import javax.sound.sampled.*;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure Java BPM detector — uses only javax.sound.sampled (built into JDK).
 * Zero external dependencies, zero added app size.
 *
 * Algorithm:
 *  1. Read WAV samples (first 60s only)
 *  2. Compute RMS energy per 10ms frame → energy envelope
 *  3. Autocorrelation on the envelope to find periodicity
 *  4. Convert dominant period → BPM, fold into 60–180 range
 */
@Service
public class BpmDetector {

    private static final int ANALYSIS_SECONDS = 60;
    private static final int FRAME_MS         = 10;   // energy frame size in ms

    public double detect(String audioFilePath) {
        try {
            File file = new File(audioFilePath);
            if (!file.exists()) {
                System.err.println("[BpmDetector] File not found: " + audioFilePath);
                return -1.0;
            }

            // ── 1. Open WAV ───────────────────────────────────────────────
            AudioInputStream raw = AudioSystem.getAudioInputStream(file);
            AudioFormat sourceFormat = raw.getFormat();

            // Convert to standard PCM 16-bit signed little-endian mono
            AudioFormat targetFormat = new AudioFormat(
                AudioFormat.Encoding.PCM_SIGNED,
                sourceFormat.getSampleRate(),
                16,       // bits
                1,        // mono — we only need energy, not stereo
                2,        // frame size (1 channel × 2 bytes)
                sourceFormat.getSampleRate(),
                false     // little-endian
            );

            AudioInputStream pcm = AudioSystem.getAudioInputStream(targetFormat, raw);
            float sampleRate     = targetFormat.getSampleRate();
            int samplesPerFrame  = (int) (sampleRate * FRAME_MS / 1000.0);
            int maxSamples       = (int) (sampleRate * ANALYSIS_SECONDS);

            // ── 2. Build energy envelope ──────────────────────────────────
            List<Double> energy = new ArrayList<>();
            byte[] buffer       = new byte[samplesPerFrame * 2]; // 2 bytes per sample
            int totalSamples    = 0;
            int bytesRead;

            while ((bytesRead = pcm.read(buffer)) > 0 && totalSamples < maxSamples) {
                int samples = bytesRead / 2;
                double sumSquares = 0;
                for (int i = 0; i < samples; i++) {
                    // Little-endian 16-bit → signed short
                    short s = (short) ((buffer[i * 2 + 1] << 8) | (buffer[i * 2] & 0xFF));
                    double normalized = s / 32768.0;
                    sumSquares += normalized * normalized;
                }
                energy.add(Math.sqrt(sumSquares / samples)); // RMS
                totalSamples += samples;
            }

            pcm.close();
            raw.close();

            if (energy.size() < 100) {
                System.err.println("[BpmDetector] Not enough audio data.");
                return -1.0;
            }

            // ── 3. Autocorrelation on energy envelope ─────────────────────
            // BPM range 60–180 → period range 333ms–1000ms
            // At 10ms/frame: lag range 33–100 frames
            int framesPerMs = 1000 / FRAME_MS; // = 100 frames per second
            int lagMin      = (int) (60.0 / 180 * framesPerMs * 1000 / 1000); // ~33
            int lagMax      = (int) (60.0 / 60  * framesPerMs * 1000 / 1000); // ~100

            // Extend range to catch harmonics before folding
            lagMin = Math.max(10,  lagMin / 2);
            lagMax = Math.min(energy.size() / 2, lagMax * 2);

            double bestCorr  = -1;
            int    bestLag   = lagMin;
            int    n         = energy.size();

            // Mean-subtract for better autocorrelation
            double mean = energy.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double[] e  = energy.stream().mapToDouble(v -> v - mean).toArray();

            for (int lag = lagMin; lag <= lagMax; lag++) {
                double corr = 0;
                for (int i = 0; i < n - lag; i++) {
                    corr += e[i] * e[i + lag];
                }
                corr /= (n - lag); // normalize by window size
                if (corr > bestCorr) {
                    bestCorr = corr;
                    bestLag  = lag;
                }
            }

            // ── 4. Lag → BPM, fold into 60–180 ───────────────────────────
            double periodMs = bestLag * FRAME_MS;
            double bpm      = 60_000.0 / periodMs;

            while (bpm < 60)  bpm *= 2;
            while (bpm > 180) bpm /= 2;

            double result = Math.round(bpm * 10.0) / 10.0;
            System.out.println("[BpmDetector] Detected BPM: " + result);
            return result;

        } catch (Exception e) {
            System.err.println("[BpmDetector] Detection failed: " + e.getMessage());
            return -1.0;
        }
    }
}