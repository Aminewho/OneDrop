package com.music.OneDrop.Controller; // Assurez-vous d'utiliser le bon package

import com.music.OneDrop.Service.YoutubeService;
import com.music.OneDrop.Dto.VideoDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@CrossOrigin(origins = "http://localhost:5000") 
public class YoutubeController {

    private final YoutubeService youtubeService;

    public YoutubeController(YoutubeService youtubeService) {
        this.youtubeService = youtubeService;
    }

    @GetMapping("/search/youtube")
    public ResponseEntity<List<VideoDto>> search(@RequestParam String q) {
        try {
            // Appeler la nouvelle méthode qui gère les deux requêtes API
            List<VideoDto> videos = youtubeService.searchVideosWithDetails(q, 5L);
            return ResponseEntity.ok(videos);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(null);
        }
    }
}