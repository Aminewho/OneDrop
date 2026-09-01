package com.music.OneDrop.Dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import java.time.ZonedDateTime;

public class VideoDto {

    @JsonAlias({"video_id", "id"})
    private String videoId;

    private String title;

    @JsonAlias({"channel_title", "uploader"})
    private String channelTitle;

    @JsonAlias({"thumbnail_url", "thumbnail"})
    private String thumbnailUrl;

    @JsonAlias({"published_at", "upload_date"})
    private ZonedDateTime publishedAt;

    private String duration; // Format ISO 8601 (ex: PT3M25S)

    @JsonAlias({"view_count", "viewCount"})
    private String views;

    // Getters and Setters
    public String getVideoId() { return videoId; }
    public void setVideoId(String videoId) { this.videoId = videoId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getChannelTitle() { return channelTitle; }
    public void setChannelTitle(String channelTitle) { this.channelTitle = channelTitle; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }



    public String getViews() { return views; }
    public void setViews(String views) { this.views = views; }
}