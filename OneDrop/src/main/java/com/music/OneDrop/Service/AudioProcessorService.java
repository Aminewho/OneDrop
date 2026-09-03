package com.music.OneDrop.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.music.OneDrop.Service.TaskStatusManager.Status;
import com.music.OneDrop.repository.VideoRepository;

@Service
public class AudioProcessorService {

    /*
     * =========================================================
     * EXTERNAL INITIALIZATION TRIGGER
     * =========================================================
     */
    public static void initPaths() {}

    /*
     * =========================================================
     * APPLICATION NAME
     * =========================================================
     */
    private static final String APP_NAME = "OneDrop";

    /*
     * =========================================================
     * INSTALL DIRECTORY RESOLVER
     * =========================================================
     */
    private static final Path APP_INSTALL_DIR;

    static {
        Path resolvedDir;
        try {
            URI uri = AudioProcessorService.class.getProtectionDomain().getCodeSource().getLocation().toURI();
            String uriStr = uri.toString();

            if (uriStr.startsWith("jar:nested:")) {
                String cleaned = uriStr.substring("jar:nested:".length());
                if (cleaned.startsWith("/")) cleaned = cleaned.substring(1);
                int jarIndex = cleaned.toLowerCase().indexOf(".jar");
                if (jarIndex != -1) cleaned = cleaned.substring(0, jarIndex + 4);
                resolvedDir = Paths.get(cleaned).getParent();
            } else if ("file".equalsIgnoreCase(uri.getScheme())) {
                resolvedDir = Paths.get(uri).getParent();
            } else {
                resolvedDir = Paths.get(System.getProperty("user.dir"));
            }

            if (resolvedDir != null && resolvedDir.getFileName().toString().equals("target")) {
                resolvedDir = resolvedDir.getParent();
            }

            APP_INSTALL_DIR = resolvedDir != null
                ? resolvedDir.toAbsolutePath()
                : Paths.get(System.getProperty("user.dir"));

        } catch (Exception e) {
            throw new RuntimeException("Cannot resolve install directory", e);
        }
    }

    /*
     * =========================================================
     * USER DATA DIRECTORY
     * =========================================================
     */
    private static final Path USER_DATA_DIR;

    static {
        String localAppData = System.getenv("LOCALAPPDATA");
        USER_DATA_DIR = (localAppData != null && !localAppData.isBlank())
            ? Paths.get(localAppData, APP_NAME)
            : Paths.get(System.getProperty("user.home"), "AppData", "Local", APP_NAME);
    }

    /*
     * =========================================================
     * PATHS
     * =========================================================
     */
    public static final Path TOOLS_DIR            = APP_INSTALL_DIR.resolve("tools");
    private static final Path MODELS_DIR           = APP_INSTALL_DIR.resolve("pretrained_models");
    private static final Path TEMP_DOWNLOAD_DIR    = USER_DATA_DIR.resolve("temp");
    private static final Path PERMANENT_TRACKS_DIR = USER_DATA_DIR.resolve("tracks");
    private static final Path DATABASE_DIR         = USER_DATA_DIR.resolve("database");

    private static final String SPLEETER_EXEC_PATH =
        TOOLS_DIR.resolve("spleeter.exe").toAbsolutePath().toString();

    public static final String YT_HELPER_EXEC_PATH =
        TOOLS_DIR.resolve("yt-helper.exe").toAbsolutePath().toString();

    private static final String YT_HELPER_URL = "http://127.0.0.1:8082";

    /*
     * =========================================================
     * STATIC INIT — create directories + validate files
     * =========================================================
     */
    static {
        try {
            Files.createDirectories(USER_DATA_DIR);
            Files.createDirectories(TEMP_DOWNLOAD_DIR);
            Files.createDirectories(PERMANENT_TRACKS_DIR);
            Files.createDirectories(DATABASE_DIR);

            System.out.println("========================================");
            System.out.println("OneDrop Application Paths Initialized");
            System.out.println("========================================");
            System.out.println("APP_INSTALL_DIR      : " + APP_INSTALL_DIR);
            System.out.println("USER_DATA_DIR        : " + USER_DATA_DIR);
            System.out.println("TOOLS_DIR            : " + TOOLS_DIR);
            System.out.println("MODELS_DIR           : " + MODELS_DIR);
            System.out.println("TEMP_DOWNLOAD_DIR    : " + TEMP_DOWNLOAD_DIR);
            System.out.println("PERMANENT_TRACKS_DIR : " + PERMANENT_TRACKS_DIR);
            System.out.println("SPLEETER_EXEC_PATH   : " + SPLEETER_EXEC_PATH);
            System.out.println("YT_HELPER_EXEC_PATH  : " + YT_HELPER_EXEC_PATH);
            System.out.println("YT_HELPER_URL        : " + YT_HELPER_URL);
            System.out.println("========================================");

            validatePathExists(TOOLS_DIR,  "tools directory");
            validatePathExists(MODELS_DIR, "pretrained_models directory");
            validateExecutable(SPLEETER_EXEC_PATH, "spleeter.exe");
            validateExecutable(YT_HELPER_EXEC_PATH, "yt-helper.exe");

        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize application directories", e);
        }
    }

    private static void validatePathExists(Path path, String description) {
        if (!Files.exists(path))
            throw new RuntimeException(description + " not found at: " + path.toAbsolutePath());
        System.out.println(description + " detected successfully.");
    }

    private static void validateExecutable(String path, String name) {
        if (!Files.exists(Paths.get(path)))
            throw new RuntimeException(name + " not found at: " + path);
        System.out.println(name + " detected successfully.");
    }

    /*
     * =========================================================
     * HTTP CLIENT — used for yt-helper download calls
     * =========================================================
     */
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    /*
     * =========================================================
     * INJECTION
     * =========================================================
     */
    private final TaskStatusManager statusManager;
    private final VideoRepository   videoRepository;
    private final BpmDetector       bpmDetector;

    public AudioProcessorService(
            TaskStatusManager statusManager,
            VideoRepository   videoRepository,
            BpmDetector       bpmDetector) {
        this.statusManager   = statusManager;
        this.videoRepository = videoRepository;
        this.bpmDetector     = bpmDetector;
    }

    /*
     * =========================================================
     * SPLEETER — runs as a direct subprocess
     * =========================================================
     */
    private int runCommand(ProcessBuilder builder) throws IOException, InterruptedException {
        System.out.println("Running: " + String.join(" ", builder.command()));
        Process process = builder.start();

        new Thread(() -> {
            try (BufferedReader r = new BufferedReader(
                    new InputStreamReader(process.getErrorStream()))) {
                String line;
                while ((line = r.readLine()) != null)
                    System.err.println("EXTERNAL ERR: " + line);
            } catch (IOException e) {
                System.err.println("Error reading stderr: " + e.getMessage());
            }
        }).start();

        boolean finished = process.waitFor(20, TimeUnit.MINUTES);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("External command timed out (>20 min).");
        }
        return process.exitValue();
    }

    /*
     * =========================================================
     * DOWNLOAD via yt-helper HTTP API
     * =========================================================
     */
    private void downloadAudioViaHelper(String videoId, String outputDir) throws Exception {
        String body = String.format(
            "{\"videoId\":\"%s\",\"outputDir\":\"%s\"}",
            videoId,
            outputDir.replace("\\", "\\\\")   // escape Windows backslashes for JSON
        );

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(YT_HELPER_URL + "/download"))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofMinutes(20))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException(
                "yt-helper /download failed [HTTP " + response.statusCode() + "]: " + response.body()
            );
        }

        System.out.println("[AudioProcessorService] Download complete for videoId: " + videoId);
    }

    /*
     * =========================================================
     * ASYNC ENTRY POINT
     * =========================================================
     */
    @Async
    public void startAudioProcessing(String videoId) {
        try {
            String durationFormatted = processAudioInternal(videoId);
            handleSuccess(videoId, durationFormatted);
        } catch (Exception e) {
            System.err.println("Processing failed for " + videoId + ": " + e.getMessage());
            e.printStackTrace();
            handleFailure(videoId);
        }
    }

    private void handleSuccess(String videoId, String formattedDuration) {
        statusManager.updateStatus(videoId, Status.COMPLETED);
        videoRepository.findById(videoId).ifPresent(entry -> {
            entry.setStatus(Status.COMPLETED.name());
            entry.setDuration(formattedDuration);
            entry.setProcessedAt(LocalDateTime.now());
            videoRepository.save(entry);
            System.out.println("COMPLETED + DB updated: " + videoId + " | Duration: " + formattedDuration + " at " + entry.getProcessedAt());
        });
    }

    private void handleFailure(String videoId) {
        statusManager.updateStatus(videoId, Status.FAILED);
        videoRepository.findById(videoId).ifPresent(entry -> {
            entry.setStatus(Status.FAILED.name());
            entry.setProcessedAt(null);
            videoRepository.save(entry);
            System.err.println("FAILED + DB updated: " + videoId);
        });
    }

    private String getWavDurationFormatted(File file) {
        if (file == null || !file.exists()) {
            return "0:00";
        }
        try (AudioInputStream audioStream = AudioSystem.getAudioInputStream(file)) {
            AudioFormat format = audioStream.getFormat();
            long frames = audioStream.getFrameLength();
            double durationInSeconds = ((double) frames / format.getFrameRate());
            long totalSeconds = Math.round(durationInSeconds);

            long minutes = totalSeconds / 60;
            long seconds = totalSeconds % 60;

            return String.format("%d:%02d", minutes, seconds);
        } catch (Exception e) {
            System.err.println("Failed to read WAV duration: " + e.getMessage());
            return "0:00";
        }
    }

    /*
     * =========================================================
     * MAIN PROCESSING PIPELINE
     * =========================================================
     */
    public String processAudioInternal(String videoId) throws Exception {

        Path videoTracksFolder = PERMANENT_TRACKS_DIR.resolve(videoId);

        /* STEP 1 — VALIDATE */
        if (Files.exists(videoTracksFolder)
                && videoTracksFolder.toFile().list() != null
                && videoTracksFolder.toFile().list().length > 0) {
            throw new IllegalStateException("Pistes audio déjà trouvées.");
        }
        Files.createDirectories(TEMP_DOWNLOAD_DIR);
        Files.createDirectories(videoTracksFolder);

        String tempInputFile = TEMP_DOWNLOAD_DIR.resolve(videoId + ".wav").toAbsolutePath().toString();

        /* STEP 2 — DOWNLOAD via yt-helper */
        statusManager.updateStatus(videoId, Status.DOWNLOADING);
        System.out.println("Downloading via yt-helper: " + videoId);

        downloadAudioViaHelper(videoId, TEMP_DOWNLOAD_DIR.toAbsolutePath().toString());

        if (!Files.exists(Paths.get(tempInputFile))) {
            throw new RuntimeException("Download completed but expected WAV not found at: " + tempInputFile);
        }

        /* STEP 3 — SPLEETER + BPM IN PARALLEL */
        statusManager.updateStatus(videoId, Status.SEPARATING);
        final String finalTempInputFile = tempInputFile;

        // Task A: Spleeter
        CompletableFuture<Integer> spleeterFuture = CompletableFuture.supplyAsync(() -> {
            try {
                String spleeterCommand = String.format(
                    "\"%s\" \"%s\" \"%s\" -p spleeter:4stems > NUL 2>&1",
                    SPLEETER_EXEC_PATH,
                    finalTempInputFile,
                    PERMANENT_TRACKS_DIR.toAbsolutePath().toString()
                );
                ProcessBuilder spleeterBuilder = new ProcessBuilder("cmd.exe", "/c", spleeterCommand);
                spleeterBuilder.directory(TOOLS_DIR.toFile());
                spleeterBuilder.environment().put("MODEL_PATH", MODELS_DIR.toAbsolutePath().toString());
                String existingPath = System.getenv("PATH");
                spleeterBuilder.environment().put("PATH",
                    TOOLS_DIR.toAbsolutePath().toString() + File.pathSeparator + existingPath);
                System.out.println("Spleeter started in parallel...");
                return runCommand(spleeterBuilder);
            } catch (Exception e) {
                System.err.println("Spleeter thread error: " + e.getMessage());
                e.printStackTrace();
                return -1;
            }
        });

        // Task B: BPM detection
        CompletableFuture<Double> bpmFuture = CompletableFuture.supplyAsync(() -> {
            System.out.println("BPM detection started in parallel...");
            double bpm = bpmDetector.detect(finalTempInputFile);
            System.out.println("BPM detected: " + bpm + " for " + videoId);
            return bpm;
        });

        CompletableFuture.allOf(spleeterFuture, bpmFuture).join();

        int    spleeterExitCode = spleeterFuture.get();
        double detectedBpm      = bpmFuture.get();

        /* SAVE BPM */
        if (detectedBpm > 0) {
            videoRepository.findById(videoId).ifPresent(entry -> {
                entry.setBpm(detectedBpm);
                videoRepository.save(entry);
                System.out.println("BPM saved: " + detectedBpm + " for " + videoId);
            });
        }

        /* STEP 4 — VERIFY SPLEETER OUTPUT */
        Path vocalsPath = videoTracksFolder.resolve("vocals.wav");
        if (spleeterExitCode != 0) {
            if (Files.exists(vocalsPath)) {
                System.out.println("WARNING: Spleeter non-zero exit (" + spleeterExitCode
                    + ") but output found — assuming success.");
            } else {
                throw new RuntimeException(
                    "Spleeter failed (code: " + spleeterExitCode + ") — no output file found.");
            }
        }

        /* STEP 5 — DURATION FORMATTING & CLEANUP */
        File downloadedWav = new File(tempInputFile);
        String formattedDuration = getWavDurationFormatted(downloadedWav);

        Files.deleteIfExists(Paths.get(tempInputFile));
        System.out.println("Processing complete. Duration: " + formattedDuration + ". Tracks stored in: " + videoTracksFolder);

        return formattedDuration;
    }
}