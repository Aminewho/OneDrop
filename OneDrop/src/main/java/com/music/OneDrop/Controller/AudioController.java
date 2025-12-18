package com.music.OneDrop.Controller;

import com.music.OneDrop.Service.AudioProcessorService;
import com.music.OneDrop.Service.TaskStatusManager;
import com.music.OneDrop.repository.VideoRepository;
import com.music.OneDrop.Service.TaskStatusManager.Status;
import com.music.OneDrop.model.VideoEntry; // Assumer l'existence de l'entité VideoEntry
import com.music.OneDrop.Dto.ProcessRequestDTO; // Assumer l'existence du DTO
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
@CrossOrigin(origins = "http://localhost:5000")
@RestController
@RequestMapping("/api/audio")
public class AudioController {

    private final AudioProcessorService audioProcessorService;
    private final TaskStatusManager statusManager;
    private final VideoRepository videoRepository;
    
    // --- Chemins (Basés sur la configuration de AudioProcessorService) ---
    private static final String APP_NAME_FOLDER = "OneDrop"; // NOTE: Utilisé dans le service
    private static final Path PERMANENT_TRACKS_DIR = 
        Paths.get(System.getProperty("user.home"), APP_NAME_FOLDER, "tracks");
    
    // Injection du service et du gestionnaire de statut
    public AudioController(AudioProcessorService audioProcessorService, TaskStatusManager statusManager, VideoRepository videoRepository) {
        this.audioProcessorService = audioProcessorService;
        this.statusManager = statusManager;
        this.videoRepository = videoRepository;
    }

    // ----------------------------------------------------------------------
    // 1. ENDPOINT POUR DÉCLENCHER LE TRAITEMENT ASYNCHRONE (POST /process)
    // ----------------------------------------------------------------------
    
    /**
     * Déclenche le téléchargement et la séparation audio de manière ASYNCHRONE.
     * Prend le videoId, le titre et la durée dans le corps de la requête (JSON).
     * Retourne immédiatement 202 Accepted.
     */
    @PostMapping("/process")
    public ResponseEntity<String> processAudio(@RequestBody ProcessRequestDTO requestDTO) {
        
        String videoId = requestDTO.getVideoId();
        
        if (videoId == null || videoId.isEmpty() || requestDTO.getVideoTitle() == null) {
            return new ResponseEntity<>("Missing videoId or videoTitle in request body.", HttpStatus.BAD_REQUEST);
        }

        Status currentStatus = statusManager.getStatus(videoId);
        
        // Empêcher de relancer une tâche déjà en cours
        if (currentStatus != null && currentStatus != Status.FAILED && currentStatus != Status.COMPLETED) {
            return new ResponseEntity<>("Task for videoId " + videoId + " is already in progress: " + currentStatus, HttpStatus.ACCEPTED);
        }

        try {
            // -------------------------------------------------------------------
            // NOUVEAU : ENREGISTRER/METTRE À JOUR DANS LA BASE DE DONNÉES H2
            // -------------------------------------------------------------------
            
            Optional<VideoEntry> existingEntry = videoRepository.findById(videoId);
            VideoEntry entryToSave;

            if (existingEntry.isPresent()) {
                // Si la vidéo existe (relance ou mise à jour)
                entryToSave = existingEntry.get();
                entryToSave.setStatus(Status.PENDING.name()); // Réinitialiser le statut
                entryToSave.setVideoTitle(requestDTO.getVideoTitle()); 
                entryToSave.setDuration(requestDTO.getDuration()); 
                entryToSave.setProcessedAt(null); // Effacer la date de complétion pour un nouveau run
                // NOTE: Laisser entryToSave.setStemsJson() inchangé ou NULL si on le gère dans le service
            } else {
                // Si c'est un nouveau traitement, créer une nouvelle entrée
                entryToSave = new VideoEntry();
                entryToSave.setVideoId(videoId);
                entryToSave.setVideoTitle(requestDTO.getVideoTitle());
                entryToSave.setDuration(requestDTO.getDuration());
                entryToSave.setStatus(Status.PENDING.name());
                entryToSave.setProcessedAt(null); 
                // RETIRÉ : entryToSave.setStemsJson(null); -> Géré par la valeur par défaut DB/Entité
            }
            
            videoRepository.save(entryToSave); // Sauvegarde/Mise à jour dans H2

            // Lancement de la méthode asynchrone : le thread HTTP est libéré immédiatement.
            audioProcessorService.startAudioProcessing(videoId);
            
            // Retourne 202 Accepted pour indiquer au front-end que le travail a commencé en arrière-plan.
            return new ResponseEntity<>("Processing started asynchronously for videoId: " + videoId, HttpStatus.ACCEPTED);
            
        } catch (Exception e) {
            System.err.println("Error starting process for " + videoId + ": " + e.getMessage());
            // En cas d'échec de lancement, mettre à jour le statut dans le manager
            statusManager.updateStatus(videoId, Status.FAILED);
            // NOTE: Une mise à jour de la DB ici serait aussi nécessaire en cas d'échec critique avant le lancement du service.
            return new ResponseEntity<>("Internal server error when trying to start process. " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ----------------------------------------------------------------------
    // 2. ENDPOINT POUR RÉCUPÉRER LE STATUT (GET /status?videoId=...)
    // ----------------------------------------------------------------------
    
    /**
     * Permet au front-end de faire du polling pour suivre la progression de la tâche.
     * Retourne le statut de la tâche (PENDING, SEPARATING, COMPLETED, etc.).
     */
    @GetMapping("/status")
    public ResponseEntity<String> getStatus(@RequestParam String videoId) {
        Status status = statusManager.getStatus(videoId);

        if (status == null) {
            // Si la tâche n'a jamais été lancée ou a été effacée
            return new ResponseEntity<>("UNKNOWN", HttpStatus.NOT_FOUND);
        }

        // Retourne le statut sous forme de chaîne simple (texte) avec 200 OK
        return new ResponseEntity<>(status.name(), HttpStatus.OK);
    }

    // ----------------------------------------------------------------------
    // 3. ENDPOINT POUR RÉCUPÉRER LA LISTE DES VIDÉOS (GET /videos)
    // ----------------------------------------------------------------------

    /**
     * Récupère toutes les entrées vidéo de la base de données (vidéos traitées ou en cours).
     * Les données sont triées par date de traitement (du plus récent au plus ancien).
     */
    @GetMapping("/videos")
    public ResponseEntity<List<VideoEntry>> getProcessedVideos() {
        try {
            // Utilise la méthode personnalisée définie dans VideoRepository pour trier
            List<VideoEntry> videos = videoRepository.findAllByOrderByProcessedAtDesc();
            
            // Filtrer les vidéos complétées (évite ConcurrentModificationException)
            List<VideoEntry> completedVideos = new java.util.ArrayList<>();
            for (VideoEntry video : videos) {
                if (video.getStatus() != null && video.getStatus().equals("COMPLETED")) {
                    completedVideos.add(video);
                }
            }
            
            return new ResponseEntity<>(completedVideos, HttpStatus.OK);
        } catch (Exception e) {
            System.err.println("Error retrieving processed videos list: " + e.getMessage());
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    
    // ----------------------------------------------------------------------
    // 4. ENDPOINT POUR SERVIR LES PISTES AUDIO (GET /serve/track?videoId=...&trackName=...)
    // ----------------------------------------------------------------------
    
    @GetMapping("/serve/track")
    public ResponseEntity<Resource> serveTrack(
        @RequestParam String videoId, 
        @RequestParam String trackName) 
    {
        // Le fichier généré par notre service est toujours un .wav
        String fileName = trackName + ".wav"; 
        
        // Construit le chemin : C:\Users\...\OneDrop\tracks\{videoId}\{trackName}.wav
        Path filePath = PERMANENT_TRACKS_DIR
            .resolve(videoId)
            .resolve(fileName);

        try {
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() && resource.isReadable()) {
                return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                    .contentType(MediaType.parseMediaType("audio/wav"))
                    .contentLength(resource.contentLength())
                    .body(resource);
            } else {
                System.err.println("Fichier introuvable ou illisible : " + filePath);
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.internalServerError().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
