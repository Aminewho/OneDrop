package com.music.OneDrop.Service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import com.music.OneDrop.repository.VideoRepository;
import com.music.OneDrop.Service.TaskStatusManager;
import com.music.OneDrop.Service.TaskStatusManager.Status;
import com.music.OneDrop.model.VideoEntry;

@Service
public class AudioProcessorService {

    
    /*
 * =========================================================
 * EXTERNAL INITIALIZATION TRIGGER
 * =========================================================
 */
public static void initPaths() {
    // Cette méthode peut rester vide. 
    // Son simple appel force la JVM à charger la classe et à exécuter TOUS ses blocs static.
}
    
    
    
    
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
                // Gestion spécifique pour Spring Boot 3 executable JAR
                String cleaned = uriStr.substring("jar:nested:".length());
                if (cleaned.startsWith("/")) {
                    cleaned = cleaned.substring(1);
                }
                int jarIndex = cleaned.toLowerCase().indexOf(".jar");
                if (jarIndex != -1) {
                    cleaned = cleaned.substring(0, jarIndex + 4);
                }
                resolvedDir = Paths.get(cleaned).getParent();
            } else if ("file".equalsIgnoreCase(uri.getScheme())) {
                resolvedDir = Paths.get(uri).getParent();
            } else {
                resolvedDir = Paths.get(System.getProperty("user.dir"));
            }

            // Si on est en Dev (dans le sous-dossier /target), on remonte à la racine du projet
            if (resolvedDir != null && resolvedDir.getFileName().toString().equals("target")) {
                resolvedDir = resolvedDir.getParent();
            }

            APP_INSTALL_DIR = resolvedDir != null ? resolvedDir.toAbsolutePath() : Paths.get(System.getProperty("user.dir"));

        } catch (Exception e) {
            throw new RuntimeException("Cannot resolve install directory", e);
        }
    }

    /*
     * =========================================================
     * USER DATA DIRECTORY (Cross-platform safe)
     * =========================================================
     */
    private static final Path USER_DATA_DIR;

    static {
        String localAppData = System.getenv("LOCALAPPDATA");
        if (localAppData != null && !localAppData.isBlank()) {
            USER_DATA_DIR = Paths.get(localAppData, APP_NAME);
        } else {
            // Remplacement des variables manquantes par des chaînes de caractères
            USER_DATA_DIR = Paths.get(System.getProperty("user.home"), "AppData", "Local", APP_NAME);
        }
    }

    /*
     * =========================================================
     * INSTALLED FILES (READ ONLY)
     * =========================================================
     */
    private static final Path TOOLS_DIR = APP_INSTALL_DIR.resolve("tools");
    private static final Path MODELS_DIR = APP_INSTALL_DIR.resolve("pretrained_models");

    /*
     * =========================================================
     * USER GENERATED FILES
     * =========================================================
     */
    private static final Path TEMP_DOWNLOAD_DIR = USER_DATA_DIR.resolve("temp");
    private static final Path PERMANENT_TRACKS_DIR = USER_DATA_DIR.resolve("tracks");
    private static final Path DATABASE_DIR = USER_DATA_DIR.resolve("database");

    /*
     * =========================================================
     * EXECUTABLES
     * =========================================================
     */
    private static final String YTDLP_EXEC_PATH = TOOLS_DIR.resolve("yt-dlp.exe").toAbsolutePath().toString();
    private static final String SPLEETER_EXEC_PATH = TOOLS_DIR.resolve("spleeter.exe").toAbsolutePath().toString();

    /*
     * INITIALIZATION & VALIDATION
     * =========================================================
     */
    static {
        try {
            /*
             * CREATE USER DIRECTORIES
             */
            Files.createDirectories(USER_DATA_DIR);
            Files.createDirectories(TEMP_DOWNLOAD_DIR);
            Files.createDirectories(PERMANENT_TRACKS_DIR);
            Files.createDirectories(DATABASE_DIR);

            /*
             * DEBUG LOGS
             */
            System.out.println("========================================");
            System.out.println("OneDrop Application Paths Initialized");
            System.out.println("========================================");
            System.out.println("APP_INSTALL_DIR      : " + APP_INSTALL_DIR);
            System.out.println("USER_DATA_DIR        : " + USER_DATA_DIR);
            System.out.println("TOOLS_DIR            : " + TOOLS_DIR);
            System.out.println("MODELS_DIR           : " + MODELS_DIR);
            System.out.println("TEMP_DOWNLOAD_DIR    : " + TEMP_DOWNLOAD_DIR);
            System.out.println("PERMANENT_TRACKS_DIR : " + PERMANENT_TRACKS_DIR);
            System.out.println("YTDLP_EXEC_PATH      : " + YTDLP_EXEC_PATH);
            System.out.println("SPLEETER_EXEC_PATH   : " + SPLEETER_EXEC_PATH);
            System.out.println("========================================");

            /*
             * VALIDATE REQUIRED FILES
             */
            validatePathExists(TOOLS_DIR, "tools directory");
            validatePathExists(MODELS_DIR, "pretrained_models directory");

            validateExecutable(YTDLP_EXEC_PATH, "yt-dlp.exe");
            validateExecutable(SPLEETER_EXEC_PATH, "spleeter.exe");

        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize application directories", e);
        }
    }

    private static void validatePathExists(Path path, String description) {
        if (!Files.exists(path)) {
            throw new RuntimeException(description + " not found at: " + path.toAbsolutePath());
        }
        System.out.println(description + " detected successfully.");
    }

    private static void validateExecutable(String path, String executableName) {
        Path executablePath = Paths.get(path);
        if (!Files.exists(executablePath)) {
            throw new RuntimeException(executableName + " not found at: " + executablePath.toAbsolutePath());
        }
        System.out.println(executableName + " detected successfully.");
    }

    private final TaskStatusManager statusManager;
    private final VideoRepository videoRepository;
    private final BpmDetector bpmDetector;

    public AudioProcessorService(TaskStatusManager statusManager, VideoRepository videoRepository, BpmDetector bpmDetector) {
        this.statusManager = statusManager;
        this.videoRepository = videoRepository;
        this.bpmDetector = bpmDetector;
    }

    private int runCommand(ProcessBuilder builder) throws IOException, InterruptedException {
        System.out.println("Attempting to run command:");
        System.out.println(String.join(" ", builder.command()));

        Process process = builder.start();

        new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.err.println("EXTERNAL ERR: " + line);
                }
            } catch (IOException e) {
                System.err.println("Error reading process error stream: " + e.getMessage());
            }
        }).start();

        boolean finished = process.waitFor(20, TimeUnit.MINUTES);

        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("External command timed out (Exceeded 20 minutes).");
        }

        return process.exitValue();
    }

    @Async
    public void startAudioProcessing(String videoId) {
        try {
            processAudioInternal(videoId);
            handleSuccess(videoId);
        } catch (Exception e) {
            System.err.println("Échec du traitement audio pour " + videoId + ": " + e.getMessage());
            e.printStackTrace();
            handleFailure(videoId);
        }
    }

    private void handleSuccess(String videoId) {
        statusManager.updateStatus(videoId, Status.COMPLETED);
        Optional<VideoEntry> optionalEntry = videoRepository.findById(videoId);

        if (optionalEntry.isPresent()) {
            VideoEntry entry = optionalEntry.get();
            entry.setStatus(Status.COMPLETED.name());
            entry.setProcessedAt(LocalDateTime.now());
            videoRepository.save(entry);

            System.out.println("Processing COMPLETED and DB updated for: " + videoId);
        } else {
            System.err.println("CRITICAL: Video entry not found in DB after successful completion: " + videoId);
        }
    }

    private void handleFailure(String videoId) {
        statusManager.updateStatus(videoId, Status.FAILED);
        Optional<VideoEntry> optionalEntry = videoRepository.findById(videoId);

        if (optionalEntry.isPresent()) {
            VideoEntry entry = optionalEntry.get();
            entry.setStatus(Status.FAILED.name());
            entry.setProcessedAt(null);
            videoRepository.save(entry);

            System.err.println("Processing FAILED and DB updated for: " + videoId);
        }
    }

    public void processAudioInternal(String videoId) throws Exception {
        Path videoTracksFolder = PERMANENT_TRACKS_DIR.resolve(videoId);

        /*
         * STEP 1 - VALIDATION
         */
        if (Files.exists(videoTracksFolder) && videoTracksFolder.toFile().list() != null && videoTracksFolder.toFile().list().length > 0) {
            throw new IllegalStateException("Pistes audio déjà trouvées.");
        }

        Files.createDirectories(TEMP_DOWNLOAD_DIR);
        Files.createDirectories(videoTracksFolder);

        String tempInputFile = TEMP_DOWNLOAD_DIR.resolve(videoId + ".wav").toAbsolutePath().toString();
        String youtubeUrl = "https://www.youtube.com/watch?v=" + videoId;

        /*
         * STEP 2 - DOWNLOAD AUDIO
         */
        statusManager.updateStatus(videoId, Status.DOWNLOADING);

        ProcessBuilder ytDlpBuilder = new ProcessBuilder(
                YTDLP_EXEC_PATH,
                "-f", "bestaudio",
                "--extract-audio",
                "--audio-format", "wav",
                "--output", tempInputFile,
                youtubeUrl
        );

        ytDlpBuilder.directory(USER_DATA_DIR.toFile());
        System.out.println("Début du téléchargement (WAV): " + videoId);

        int ytDlpExitCode = runCommand(ytDlpBuilder);

        if (ytDlpExitCode != 0) {
            throw new RuntimeException("yt-dlp failed with exit code: " + ytDlpExitCode);
        }

        /*
         * STEP 3 - SPLEETER + BPM IN PARALLEL
         */
        statusManager.updateStatus(videoId, Status.SEPARATING);
        final String finalTempInputFile = tempInputFile;

        /*
         * TASK A - SPLEETER
         */
        CompletableFuture<Integer> spleeterFuture = CompletableFuture.supplyAsync(() -> {
            try {
                String spleeterCommand = String.format(
                        "\"%s\" \"%s\" \"%s\" -p spleeter:4stems > NUL 2>&1",
                        SPLEETER_EXEC_PATH,
                        finalTempInputFile,
                        PERMANENT_TRACKS_DIR.toAbsolutePath().toString()
                );

                ProcessBuilder spleeterBuilder = new ProcessBuilder("cmd.exe", "/c", spleeterCommand);
                spleeterBuilder.directory(USER_DATA_DIR.toFile());
                spleeterBuilder.environment().put("MODEL_PATH", MODELS_DIR.toAbsolutePath().toString());

                System.out.println("Spleeter démarré en parallèle...");
                return runCommand(spleeterBuilder);

            } catch (Exception e) {
                System.err.println("Erreur thread Spleeter: " + e.getMessage());
                e.printStackTrace();
                return -1;
            }
        });

        /*
         * TASK B - BPM DETECTION
         */
        CompletableFuture<Double> bpmFuture = CompletableFuture.supplyAsync(() -> {
            System.out.println("Détection BPM démarrée en parallèle...");
            double bpm = bpmDetector.detect(finalTempInputFile);
            System.out.println("BPM détecté : " + bpm + " pour " + videoId);
            return bpm;
        });

        /*
         * WAIT FOR BOTH TASKS
         */
        CompletableFuture.allOf(spleeterFuture, bpmFuture).join();

        int spleeterExitCode = spleeterFuture.get();
        double detectedBpm = bpmFuture.get();

        /*
         * SAVE BPM
         */
        if (detectedBpm > 0) {
            videoRepository.findById(videoId).ifPresent(entry -> {
                entry.setBpm(detectedBpm);
                videoRepository.save(entry);
                System.out.println("BPM sauvegardé : " + detectedBpm + " pour " + videoId);
            });
        }

        /*
         * STEP 4 - VERIFY OUTPUT
         */
        Path vocalsPath = videoTracksFolder.resolve("vocals.wav");

        if (spleeterExitCode != 0) {
            if (Files.exists(vocalsPath)) {
                System.out.println("WARNING: Spleeter code non-zéro (" + spleeterExitCode + ") mais fichier trouvé — succès supposé.");
            } else {
                throw new RuntimeException("Spleeter failed (Code: " + spleeterExitCode + ") and no output file found.");
            }
        }

        /*
         * STEP 5 - CLEANUP
         */
        Files.deleteIfExists(Paths.get(tempInputFile));
        System.out.println("Traitement terminé. Pistes stockées dans : " + videoTracksFolder);
    }
}