package com.music.OneDrop.Dto;

import java.time.ZonedDateTime;

public class VideoDto {
    private String videoId;
    private String title;
    private String channelTitle;
    private String thumbnailUrl;
    private ZonedDateTime publishedAt;
    private String duration; // Format ISO 8601 (ex: PT3M25S)

    // Vous pouvez ajouter un constructeur et des méthodes getter/setter ici
    // Utilisation d'un record (Java 16+) ou Lombok simplifierait ce code.

    // Getters et Setters pour tous les champs
    public String getVideoId() { return videoId; }
    public void setVideoId(String videoId) { this.videoId = videoId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getChannelTitle() { return channelTitle; }
    public void setChannelTitle(String channelTitle) { this.channelTitle = channelTitle; }
    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }
    public ZonedDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(ZonedDateTime publishedAt) { this.publishedAt = publishedAt; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
}