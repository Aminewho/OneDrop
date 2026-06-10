package com.music.OneDrop.Controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import com.music.OneDrop.Service.SpotifyService;

@RestController
@RequestMapping("/search")
public class SpotifyController {

    @Autowired
    private SpotifyService spotifyService;

    /**
     * Proxies the Spotify search request from the React frontend to the Spotify API.
     * The frontend calls: GET http://127.0.0.1:8080/api/spotify-search?query=...
     * * @param query The search query string (e.g., "john mayer").
     * @param authorizationHeader The "Bearer <token>" header passed from the frontend.
     * @return A ResponseEntity containing the Spotify API's status and JSON body.
     */
   @GetMapping("/spotify-search")
    public ResponseEntity<String> search(@RequestParam String query) {
        try {
            ResponseEntity<String> response = spotifyService.searchSpotifyCatalog(query);
            return response;
        } catch (Exception e) {
            System.err.println("Unexpected error during Spotify search proxy: " + e.getMessage());
            return ResponseEntity
                    .internalServerError()
                    .body("{\"error\": \"Backend proxy failed due to internal error: " + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/artists/{artistId}/top-tracks")
    public ResponseEntity<String> getArtistTopTracks(@PathVariable String artistId) {
        try {
            return spotifyService.getArtistTopTracks(artistId);
        } catch (Exception e) {
            System.err.println("Unexpected error during Spotify artist top tracks proxy: " + e.getMessage());
            return ResponseEntity
                    .internalServerError()
                    .body("{\"error\": \"Backend proxy failed due to internal error: " + e.getMessage() + "\"}");
        }
    }

    /**
     * Endpoint pour récupérer les albums principaux d'un artiste spécifique
     * en utilisant l'ID de l'artiste.
     * URL d'appel côté frontend: GET /api/spotify/artists/{artistId}/albums
     * @param artistId L'ID Spotify de l'artiste (extrait du chemin de l'URL).
     * @return ResponseEntity<String> contenant les données des albums ou une erreur.
     */
    @GetMapping("/artists/{artistId}/albums")
    public ResponseEntity<String> getArtistAlbumsController(@PathVariable String artistId) {
        System.out.println("-> Contrôleur appelé: getArtistAlbumsController pour l'artiste ID: " + artistId);
        return spotifyService.getArtistAlbums(artistId);
    }
    /**
     * Endpoint pour récupérer les pistes (tracks) d'un album spécifique.
     * URL d'appel côté frontend: GET /api/spotify/albums/{albumId}/tracks
     * * @param albumId L'ID Spotify de l'album (extrait du chemin de l'URL).
     * @param authorizationHeader Le jeton d'accès (Bearer token) passé par le frontend.
     * @return ResponseEntity<String> contenant les données des pistes ou une erreur.
     */
    @GetMapping("/albums/{albumId}/tracks")
    public ResponseEntity<String> getAlbumTracksController(@PathVariable String albumId) {
        System.out.println("-> Contrôleur appelé: getAlbumTracksController pour l'album ID: " + albumId);
        return spotifyService.getAlbumTracks(albumId);
    }
}