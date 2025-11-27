package com.music.OneDrop.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDateTime;

/**
 * Entité de base de données pour stocker les métadonnées des vidéos et l'état du traitement.
 */
@Entity
public class VideoEntry {

    @Id
    private String videoId;

    private String videoTitle;
    private String duration; // Durée originale de la vidéo (string pour la simplicité)
    private String status; // Statut du traitement (PENDING, SEPARATING, COMPLETED, FAILED)

    // Stocke la date de fin de traitement
    private LocalDateTime processedAt;

    // Colonne pour stocker la structure JSON des pistes séparées. Utilisation de CLOB pour de grandes chaînes.
    @Column(columnDefinition = "CLOB")
    private String stemsJson; 

    // --- Constructeur ---
    public VideoEntry() {
    }

    // --- Getters et Setters ---

    public String getVideoId() {
        return videoId;
    }

    public void setVideoId(String videoId) {
        this.videoId = videoId;
    }

    public String getVideoTitle() {
        return videoTitle;
    }

    public void setVideoTitle(String videoTitle) {
        this.videoTitle = videoTitle;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(LocalDateTime processedAt) {
        this.processedAt = processedAt;
    }

  
}
