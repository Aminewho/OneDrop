package com.music.OneDrop.Service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TaskStatusManager {

    // Enumération des statuts possibles pour la tâche
    public enum Status {
        PENDING,       // En attente de traitement
        DOWNLOADING,   // Téléchargement du fichier audio
        SEPARATING,    // Séparation des pistes audio (Spleeter)
        COMPLETED,     // Terminé avec succès
        FAILED         // Échec du traitement
    }

    // Map thread-safe pour stocker le statut de chaque ID de vidéo
    // Clé: videoId (String), Valeur: Status
    private final Map<String, Status> taskStatuses = new ConcurrentHashMap<>();

    /**
     * Met à jour le statut d'une tâche spécifique.
     * @param videoId L'ID de la vidéo.
     * @param newStatus Le nouveau statut de la tâche.
     */
    public void updateStatus(String videoId, Status newStatus) {
        taskStatuses.put(videoId, newStatus);
        System.out.println("STATUS UPDATE: Video " + videoId + " is now " + newStatus);
    }

    /**
     * Récupère le statut actuel d'une tâche.
     * @param videoId L'ID de la vidéo.
     * @return Le statut actuel ou null si la tâche n'existe pas.
     */
    public Status getStatus(String videoId) {
        return taskStatuses.get(videoId);
    }
    
    /**
     * Supprime une tâche terminée ou échouée de la mémoire (optionnel).
     * @param videoId L'ID de la vidéo.
     */
    public void removeTask(String videoId) {
        taskStatuses.remove(videoId);
    }
}