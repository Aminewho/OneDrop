package com.music.OneDrop.Config;

import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.google.api.services.youtube.YouTube;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class YoutubeConfig {

    @Bean
    public YouTube youTube() {
        // Initialiser le client YouTube API
        return new YouTube.Builder(
                new NetHttpTransport(), // Pour la gestion des requêtes HTTP
                JacksonFactory.getDefaultInstance(), // Pour la désérialisation JSON
                request -> {} // Ne pas ajouter de Credential pour une simple clé API
        ).setApplicationName("OneDrop").build();
    }
}