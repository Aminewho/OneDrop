package com.music.OneDrop.Service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

// Importez les classes de statut que nous avons définies
import com.music.OneDrop.Service.TaskStatusManager; 
import com.music.OneDrop.Service.TaskStatusManager.Status;

@Service
public class AudioProcessorService {

    // --- 1. CONFIGURATION DES CHEMINS DYNAMIQUES ET DES EXÉCUTABLES ---
    
    // Le nom du dossier de l'application (correspondant à l'attente de Spleeter)
    private static final String APP_NAME_FOLDER = "OneDrop"; 
    
    // Chemin de base : C:\Users\Nom\OneDrop
    private static final String APP_DATA_DIR_STRING = 
        System.getProperty("user.home") + File.separator + APP_NAME_FOLDER; 
    
    // Dossiers de travail : ...\OneDrop\temp et ...\OneDrop\tracks
    private static final Path TEMP_DOWNLOAD_DIR = Paths.get(APP_DATA_DIR_STRING, "temp");
    private static final Path PERMANENT_TRACKS_DIR = Paths.get(APP_DATA_DIR_STRING, "tracks");
    
    // Chemin du répertoire d'exécution (où le JAR/Exécutable est lancé)
    private static final String WORKING_DIR = System.getProperty("user.dir"); 
    
    // Chemins absolus vers les exécutables (doivent être dans le dossier 'tools')
    private static final String YTDLP_EXEC_PATH = 
        Paths.get(WORKING_DIR, "tools", "yt-dlp.exe").toAbsolutePath().toString(); 
    private static final String SPLEETER_EXEC_PATH = 
        Paths.get(WORKING_DIR, "tools", "spleeter.exe").toAbsolutePath().toString(); 

    // Injection du gestionnaire de statut
    private final TaskStatusManager statusManager;

    public AudioProcessorService(TaskStatusManager statusManager) {
        this.statusManager = statusManager;
    }

    // --- 2. FONCTION UTILITAIRE : EXÉCUTION DE COMMANDE (MODIFIÉE) ---
    
    /**
     * Exécute une commande système et retourne son code de sortie.
     * @param builder Le ProcessBuilder configuré.
     * @return Le code de sortie du processus.
     */
    private int runCommand(ProcessBuilder builder) throws IOException, InterruptedException {
        
        System.out.println("Attempting to run command: " + String.join(" ", builder.command()));
        Process process = builder.start();
        
        // Lire et loguer la sortie d'erreur (pour les messages TensorFlow)
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

        // Attendre la fin du processus avec un timeout
        boolean finished = process.waitFor(20, TimeUnit.MINUTES);
        
        if (!finished) {
             process.destroyForcibly();
             throw new RuntimeException("External command timed out (Exceeded 20 minutes).");
        }
        
        // Ne lève plus d'exception ici, le code appelant (processAudioInternal) gère le code de sortie.
        return process.exitValue();
    }
    
    // --- 3. LOGIQUE ASYNCHRONE PRINCIPALE ---
    
    /**
     * Démarre le traitement audio dans un thread séparé et met à jour l'état.
     */
    @Async 
    public void startAudioProcessing(String videoId) {
        
        statusManager.updateStatus(videoId, Status.PENDING);
        
        try {
            processAudioInternal(videoId);
            statusManager.updateStatus(videoId, Status.COMPLETED);
            
        } catch (Exception e) {
            System.err.println("Échec du traitement audio pour " + videoId + ": " + e.getMessage());
            statusManager.updateStatus(videoId, Status.FAILED);
        }
    }

    /**
     * Contient la logique séquentielle de téléchargement et de séparation.
     */
    public void processAudioInternal(String videoId) throws Exception {
        
        Path videoTracksFolder = PERMANENT_TRACKS_DIR.resolve(videoId);
        
        // --- ÉTAPE 1: VÉRIFICATION & PRÉPARATION ---
        if (videoTracksFolder.toFile().exists() && videoTracksFolder.toFile().list().length > 0) {
             throw new IllegalStateException("Pistes audio déjà trouvées.");
        }
        
        TEMP_DOWNLOAD_DIR.toFile().mkdirs();
        videoTracksFolder.toFile().mkdirs();

        String tempInputFile = TEMP_DOWNLOAD_DIR.resolve(videoId + ".wav").toString();
        String youtubeUrl = "https://www.youtube.com/watch?v=" + videoId;
        
        // --- ÉTAPE 2: TÉLÉCHARGEMENT AVEC YOUTUBE-DLP ---
        statusManager.updateStatus(videoId, Status.DOWNLOADING); 
        
        ProcessBuilder ytDlpBuilder = new ProcessBuilder(
            YTDLP_EXEC_PATH, 
            "-f", "bestaudio",          
            "--extract-audio",          
            "--audio-format", "wav",    
            "--output", tempInputFile,  
            youtubeUrl
        );

        System.out.println("Début du téléchargement (WAV): " + videoId);
        int ytDlpExitCode = runCommand(ytDlpBuilder);
        
        if (ytDlpExitCode != 0) {
            throw new RuntimeException("yt-dlp failed with exit code: " + ytDlpExitCode);
        }

        // --- ÉTAPE 3: SÉPARATION AVEC SPLEETER (TOLÉRANCE D'ERREUR) ---
        statusManager.updateStatus(videoId, Status.SEPARATING); 
        
        // 🛑 Utilisation de cmd.exe /c pour la redirection de sortie et la syntaxe shell

    String spleeterCommand = String.format(
    "%s %s %s -p spleeter:2stems > NUL 2>&1", // Ajout de "> NUL 2>&1"
    SPLEETER_EXEC_PATH, 
    tempInputFile,                           
    PERMANENT_TRACKS_DIR.toString()         
    );
 
        ProcessBuilder spleeterBuilder = new ProcessBuilder(
            "cmd.exe", 
            "/c",
            spleeterCommand
        );
        
        System.out.println("Début de la séparation Spleeter...");
        int spleeterExitCode = runCommand(spleeterBuilder);
        
        // Vérification critique après l'exécution de Spleeter
        Path vocalsPath = videoTracksFolder.resolve("vocals.wav");        
        if (spleeterExitCode != 0) {
            // Tolère le code d'erreur 1 SI le travail a été fait (fichier 'vocals.wav' créé).
            if (Files.exists(vocalsPath)) {
                System.out.println("WARNING: Spleeter returned non-zero exit code (" + spleeterExitCode + 
                                   "), but output file found. Assuming success.");
            } else {
                // Échec réel si code != 0 et pas de fichier trouvé
                throw new RuntimeException("Spleeter failed (Code: " + spleeterExitCode + ") and no output file found.");
            }
        }

        // --- ÉTAPE 4: NETTOYAGE ET FINALISATION ---
        
        // Suppression du fichier .wav temporaire
        Files.deleteIfExists(Paths.get(tempInputFile));
        
        System.out.println("Traitement terminé. Pistes stockées dans : " + videoTracksFolder);
    }
}