package com.music.OneDrop.Service;

import com.google.api.services.youtube.YouTube;
import com.google.api.services.youtube.model.SearchListResponse;
import com.google.api.services.youtube.model.SearchResult;
import com.google.api.services.youtube.model.Video;
import com.google.api.services.youtube.model.VideoListResponse;
import com.music.OneDrop.Dto.VideoDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class YoutubeService {

    private final YouTube youTube;

    @Value("${youtube.api.key}")
    private String apiKey;

    public YoutubeService(YouTube youTube) {
        this.youTube = youTube;
    }

    public List<VideoDto> searchVideosWithDetails(String query, long maxResults) throws IOException {
        
        // --- 1. PREMIER APPEL : Récupérer les IDs des vidéos (search.list) ---
        
        YouTube.Search.List search = youTube.search().list("id");
        search.setKey(apiKey);
        search.setQ(query);
        search.setType("video");
        // Nous demandons seulement l'ID. Nous allons récupérer les autres détails dans le 2e appel.
        search.setFields("items/id/videoId");
        search.setMaxResults(maxResults);

        SearchListResponse searchResponse = search.execute();
        List<SearchResult> searchResults = searchResponse.getItems();

        // Si aucun résultat, retourner une liste vide
        if (searchResults.isEmpty()) {
            return new ArrayList<>();
        }

        // Collecter tous les IDs des vidéos dans une seule chaîne séparée par des virgules
        String videoIds = searchResults.stream()
                .map(result -> result.getId().getVideoId())
                .collect(Collectors.joining(","));

        // --- 2. DEUXIÈME APPEL : Récupérer les détails (videos.list) ---
        
        YouTube.Videos.List videoListRequest = youTube.videos().list("snippet,contentDetails");
        videoListRequest.setKey(apiKey);
        videoListRequest.setId(videoIds); 
        // Demander les champs 'snippet' (titre, chaîne, date, miniatures) et 'contentDetails' (durée)
        videoListRequest.setFields("items(id,snippet(title,channelTitle,publishedAt,thumbnails/default/url),contentDetails/duration)");
        
        VideoListResponse videoListResponse = videoListRequest.execute();
        
        // --- 3. MAPPING : Convertir les objets Video en DTO ---

        return videoListResponse.getItems().stream()
                .map(this::mapToVideoDto)
                .collect(Collectors.toList());
    }

    // Méthode utilitaire pour mapper l'objet Video complet au DTO simplifié
    private VideoDto mapToVideoDto(Video video) {
        VideoDto dto = new VideoDto();
        dto.setVideoId(video.getId());
        
        // Données du Snippet (disponibles dans la ressource Video complète)
        if (video.getSnippet() != null) {
            dto.setTitle(video.getSnippet().getTitle());
            dto.setChannelTitle(video.getSnippet().getChannelTitle());
            // Utiliser la miniature par défaut
            if (video.getSnippet().getThumbnails() != null && video.getSnippet().getThumbnails().getDefault() != null) {
                 dto.setThumbnailUrl(video.getSnippet().getThumbnails().getDefault().getUrl());
            }
            // La date est un objet DateTime de Google, que nous convertissons en ZonedDateTime (pour Java)
            if (video.getSnippet().getPublishedAt() != null) {
                String rfc3339 = video.getSnippet().getPublishedAt().toStringRfc3339();
                java.time.ZonedDateTime zonedDateTime = java.time.ZonedDateTime.parse(rfc3339, java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                dto.setPublishedAt(zonedDateTime);
            }
        }
        
        // Données de ContentDetails (inclut la durée)
        if (video.getContentDetails() != null) {
            // La durée est retournée au format ISO 8601 (ex: PT3M25S)
            dto.setDuration(video.getContentDetails().getDuration()); 
        }

        return dto;
    }
}