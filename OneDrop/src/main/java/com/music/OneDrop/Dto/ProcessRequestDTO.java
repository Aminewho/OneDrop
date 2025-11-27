package com.music.OneDrop.Dto;

 public class ProcessRequestDTO {
    
    private String videoId;
    private String videoTitle;
    private String duration; // Durée au format ISO 8601 (PT...S)
    
    // Constructeur par défaut requis par Jackson (Spring)
    public ProcessRequestDTO() {}

    // Getters et Setters (requis pour la désérialisation JSON)
    
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
}

