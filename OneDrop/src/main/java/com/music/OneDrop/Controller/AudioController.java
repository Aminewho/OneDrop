package com.music.OneDrop.Controller;

import com.music.OneDrop.Dto.ProcessRequestDTO;
import com.music.OneDrop.Service.AudioProcessorService;
import com.music.OneDrop.Service.TaskStatusManager;
import com.music.OneDrop.Service.TaskStatusManager.Status;
import com.music.OneDrop.model.VideoEntry;
import com.music.OneDrop.repository.VideoRepository;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/audio")
public class AudioController {

    /*
     * =========================================================
     * SERVICES
     * =========================================================
     */
    private final AudioProcessorService audioProcessorService;
    private final TaskStatusManager statusManager;
    private final VideoRepository videoRepository;

    /*
     * =========================================================
     * APPLICATION PATHS (Cross-platform safe)
     * =========================================================
     */
    private static final String APP_NAME = "OneDrop";
    private static final Path APP_ROOT;
    private static final Path TRACKS_DIR;

    static {
        String localAppData = System.getenv("LOCALAPPDATA");
        if (localAppData != null && !localAppData.isBlank()) {
            APP_ROOT = Paths.get(localAppData, APP_NAME);
        } else {
            // Repli universel si LOCALAPPDATA n'est pas défini (ex: environnements Linux/macOS ou conteneurs)
            APP_ROOT = Paths.get(System.getProperty("user.home"), "AppData", "Local", APP_NAME);
        }
        TRACKS_DIR = APP_ROOT.resolve("tracks");
    }

    /*
     * =========================================================
     * CONSTRUCTOR
     * =========================================================
     */
    public AudioController(
            AudioProcessorService audioProcessorService,
            TaskStatusManager statusManager,
            VideoRepository videoRepository
    ) {
        this.audioProcessorService = audioProcessorService;
        this.statusManager = statusManager;
        this.videoRepository = videoRepository;

        /*
         * CREATE REQUIRED DIRECTORIES
         */
        try {
            Files.createDirectories(APP_ROOT);
            Files.createDirectories(TRACKS_DIR);

            System.out.println("========================================");
            System.out.println("AudioController initialized");
            System.out.println("APP_ROOT   : " + APP_ROOT.toAbsolutePath());
            System.out.println("TRACKS_DIR : " + TRACKS_DIR.toAbsolutePath());
            System.out.println("========================================");

        } catch (IOException e) {
            throw new RuntimeException("Failed to initialize application directories", e);
        }
    }

    /*
     * =========================================================
     * 1. PROCESS AUDIO
     * POST /api/audio/process
     * =========================================================
     */
    @PostMapping("/process")
    public ResponseEntity<String> processAudio(@RequestBody ProcessRequestDTO requestDTO) {
        String videoId = requestDTO.getVideoId();

        /*
         * VALIDATION
         */
        if (videoId == null || videoId.isBlank() || requestDTO.getVideoTitle() == null || requestDTO.getVideoTitle().isBlank()) {
            return new ResponseEntity<>("Missing videoId or videoTitle in request body.", HttpStatus.BAD_REQUEST);
        }

        Status currentStatus = statusManager.getStatus(videoId);

        /*
         * PREVENT DUPLICATE PROCESSING
         */
        if (currentStatus != null && currentStatus != Status.FAILED && currentStatus != Status.COMPLETED) {
            return new ResponseEntity<>("Task for videoId " + videoId + " is already in progress: " + currentStatus, HttpStatus.ACCEPTED);
        }

        try {
            /*
             * CREATE OR UPDATE DATABASE ENTRY
             */
            Optional<VideoEntry> existingEntry = videoRepository.findById(videoId);
            VideoEntry entryToSave;

            if (existingEntry.isPresent()) {
                /*
                 * UPDATE EXISTING ENTRY
                 */
                entryToSave = existingEntry.get();
                entryToSave.setStatus(Status.PENDING.name());
                entryToSave.setVideoTitle(requestDTO.getVideoTitle());
                entryToSave.setDuration(requestDTO.getDuration());
                entryToSave.setProcessedAt(null);
            } else {
                /*
                 * CREATE NEW ENTRY
                 */
                entryToSave = new VideoEntry();
                entryToSave.setVideoId(videoId);
                entryToSave.setVideoTitle(requestDTO.getVideoTitle());
                entryToSave.setDuration(requestDTO.getDuration());
                entryToSave.setStatus(Status.PENDING.name());
                entryToSave.setProcessedAt(null);
            }

            /*
             * SAVE TO DATABASE
             */
            videoRepository.save(entryToSave);

            /*
             * START ASYNC PROCESSING
             */
            audioProcessorService.startAudioProcessing(videoId);

            return new ResponseEntity<>("Processing started asynchronously for videoId: " + videoId, HttpStatus.ACCEPTED);

        } catch (Exception e) {
            System.err.println("Error starting process for " + videoId + ": " + e.getMessage());
            e.printStackTrace();
            statusManager.updateStatus(videoId, Status.FAILED);

            return new ResponseEntity<>("Internal server error when trying to start process. " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /*
     * =========================================================
     * 2. GET PROCESS STATUS
     * GET /api/audio/status?videoId=...
     * =========================================================
     */
    @GetMapping("/status")
    public ResponseEntity<String> getStatus(@RequestParam String videoId) {
        Status status = statusManager.getStatus(videoId);

        if (status == null) {
            return new ResponseEntity<>("UNKNOWN", HttpStatus.NOT_FOUND);
        }

        return new ResponseEntity<>(status.name(), HttpStatus.OK);
    }

    /*
     * =========================================================
     * 3. GET ALL PROCESSED VIDEOS
     * GET /api/audio/videos
     * =========================================================
     */
    @GetMapping("/videos")
    public ResponseEntity<List<VideoEntry>> getProcessedVideos() {
        try {
            List<VideoEntry> videos = videoRepository.findAllByOrderByProcessedAtDesc();
            List<VideoEntry> completedVideos = new ArrayList<>();

            /*
             * KEEP ONLY COMPLETED VIDEOS
             */
            for (VideoEntry video : videos) {
                if (video.getStatus() != null && video.getStatus().equals("COMPLETED")) {
                    completedVideos.add(video);
                }
            }

            return new ResponseEntity<>(completedVideos, HttpStatus.OK);

        } catch (Exception e) {
            System.err.println("Error retrieving processed videos list: " + e.getMessage());
            e.printStackTrace();
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /*
     * =========================================================
     * 4. SERVE AUDIO TRACK
     * GET /api/audio/serve/track
     * =========================================================
     */
    @GetMapping("/serve/track")
    public ResponseEntity<Resource> serveTrack(@RequestParam String videoId, @RequestParam String trackName) {
        /*
         * GENERATED FILES ARE ALWAYS WAV
         */
        String fileName = trackName + ".wav";

        /*
         * FINAL PATH:
         * AppData/Local/OneDrop/tracks/{videoId}/{trackName}.wav
         */
        Path filePath = TRACKS_DIR.resolve(videoId).resolve(fileName);

        try {
            System.out.println("Serving track from path: " + filePath.toAbsolutePath());

            /*
             * SECURITY CHECK: PREVENT PATH TRAVERSAL
             * Blindage absolu en forçant la résolution normalisée complète des deux côtés
             */
            Path normalizedPath = filePath.toAbsolutePath().normalize();
            Path absoluteTracksDir = TRACKS_DIR.toAbsolutePath().normalize();

            if (!normalizedPath.startsWith(absoluteTracksDir)) {
                System.err.println("Blocked suspicious path traversal attempt: " + normalizedPath);
                return ResponseEntity.badRequest().build();
            }

            Resource resource = new UrlResource(normalizedPath.toUri());

            /*
             * VERIFY FILE
             */
            if (resource.exists() && resource.isReadable()) {
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                        .contentType(MediaType.parseMediaType("audio/wav"))
                        .contentLength(resource.contentLength())
                        .body(resource);
            } else {
                System.err.println("Fichier introuvable ou illisible : " + normalizedPath);
                return ResponseEntity.notFound().build();
            }

        } catch (MalformedURLException e) {
            System.err.println("Malformed URL while serving track: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        } catch (IOException e) {
            System.err.println("IO error while serving track: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}