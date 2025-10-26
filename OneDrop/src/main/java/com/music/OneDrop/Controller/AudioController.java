package com.music.OneDrop.Controller;

import com.music.OneDrop.Service.AudioProcessorService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/audio")
@CrossOrigin(origins = "http://localhost:5000") // Assurez-vous que l'origine de votre frontend est correcte
public class AudioController {

    private final AudioProcessorService audioProcessorService;

    // Chemin défini dans AudioProcessorService pour le stockage des pistes
    // NOTE: Idéalement, on devrait le récupérer du service ou d'une configuration. 
    // Pour la cohérence, on va le redéfinir ici (ou créer une méthode getter dans le service).
    // Nous allons le définir comme constante locale basée sur la structure du service.
    private static final String APP_NAME_FOLDER = "OneDropMusic";
    private static final Path PERMANENT_TRACKS_DIR = 
        Paths.get(System.getProperty("user.home"), APP_NAME_FOLDER, "tracks");
    
    // Injection du service
    public AudioController(AudioProcessorService audioProcessorService) {
        this.audioProcessorService = audioProcessorService;
    }

    // ----------------------------------------------------------------------
    // 1. ENDPOINT POUR DÉCLENCHER LE TRAITEMENT SPLEETER (POST /process)
    // ----------------------------------------------------------------------
    
    /**
     * Déclenche le téléchargement de l'audio, la séparation Spleeter et le stockage local.
     * Cette méthode doit être appelée une seule fois par vidéo.
     * * @param videoId L'ID de la vidéo YouTube.
     * @return Statut de la requête.
     */
    @PostMapping("/process")
    // NOTE : Ajoutez @Async à cette méthode (et activez-la dans la config Spring)
    // si vous ne voulez pas que la requête HTTP bloque pendant 5-15 minutes !
    public ResponseEntity<String> processAudioAndStore(@RequestParam String videoId) 
    {
        try {
            audioProcessorService.processAudioInternal(videoId);

            return ResponseEntity.ok()
                .body("Traitement Spleeter terminé. Les pistes sont stockées localement.");

        } catch (IllegalStateException e) {
            // Statut 409 Conflict si les pistes existent déjà
            return ResponseEntity.status(409).body("Pistes pour cette vidéo déjà disponibles.");
        } catch (Exception e) {
            System.err.println("Échec du traitement audio pour " + videoId + ": " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Échec critique du traitement audio.");
        }
    }

    // ----------------------------------------------------------------------
    // 2. ENDPOINT POUR SERVIR LES PISTES AUDIO (GET /serve/track)
    // ----------------------------------------------------------------------
    
    /**
     * Sert un fichier de piste audio stocké localement au client (streaming).
     * * @param videoId L'ID de la vidéo parente.
     * @param trackName Le nom de la piste (ex: "vocals", "drums", etc.).
     * @return La piste audio sous forme de flux de données (Resource).
     */
    @GetMapping("/serve/track")
    public ResponseEntity<Resource> serveTrack(
        @RequestParam String videoId, 
        @RequestParam String trackName) 
    {
        // Le nom de fichier par défaut de Spleeter est {trackName}.wav
        String fileName = trackName + ".wav"; 
        
        // Chemin complet du fichier sur le disque local de l'utilisateur
        // Ex: C:\Users\Nom\OneDropMusic\tracks\OmTOEdNyT6c\vocals.wav
        Path filePath = PERMANENT_TRACKS_DIR
            .resolve(videoId)
            .resolve(fileName);

        try {
            // 1. Création de la ressource Spring à partir du chemin URI
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() && resource.isReadable()) {
                
                // 2. Définition du type de média (MIME type)
                // Spleeter produit des fichiers WAV par défaut.
                MediaType contentType = MediaType.parseMediaType("audio/wav"); 

                // 3. Renvoi de la réponse avec les headers pour le streaming
                return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                    .contentType(contentType)
                    .body(resource);
            } else {
                // Fichier introuvable
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            System.err.println("Erreur de chemin de fichier: " + filePath.toString());
            return ResponseEntity.internalServerError().build();
        }
    }
}