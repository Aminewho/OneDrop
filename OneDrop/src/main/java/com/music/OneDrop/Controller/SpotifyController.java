package com.music.OneDrop.Controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import com.music.OneDrop.Service.SpotifyService;

@RestController
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
    @GetMapping("/spotify-search") // Maps the method to /api/spotify-search
    public ResponseEntity<String> searchSpotify(
            @RequestParam String query,
            // Use required = false to handle the case where the header might be missing 
            // during initial setup/debug, then check for its presence manually.
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader) {

        // --- 1. Validation (Check for Token) ---
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            // If the token is missing or malformed, return 401 explicitly.
            // This is crucial for the frontend's token refresh logic.
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body("{\"error\": \"Missing or invalid Spotify Access Token in Authorization header.\"}");
        }

        // --- 2. Call Service Proxy ---
        try {
            // Forward the validated request to the service layer for the external HTTP call
            ResponseEntity<String> response = spotifyService.searchSpotifyCatalog(query, authorizationHeader);
            
            // The service handles passing back non-200 statuses (401, 404, etc.)
            return response;
            
        } catch (Exception e) {
            // Catch unexpected runtime errors (e.g., service configuration failure)
            System.err.println("Unexpected error during Spotify search proxy: " + e.getMessage());
            return ResponseEntity
                    .internalServerError()
                    .body("{\"error\": \"Backend proxy failed due to internal error: " + e.getMessage() + "\"}");
        }
    }
   @GetMapping("/profile")
    public ResponseEntity<String> getUserProfile(
        @RequestHeader("Authorization") String authorizationHeader) {

    // Calls the new service method
    return spotifyService.getUserProfile(authorizationHeader);
    } 
      @GetMapping("/topArtists")
    public ResponseEntity<String> getTopArtists(
        @RequestHeader("Authorization") String authorizationHeader) {

    // Calls the new service method
    return spotifyService.getTopArtists(authorizationHeader);
    } 
      @GetMapping("/followingArtists")
    public ResponseEntity<String> getFollowing(
        @RequestHeader("Authorization") String authorizationHeader) {

    // Calls the new service method
    return spotifyService.getFollowing(authorizationHeader);
    } 



     @GetMapping("/artistsTopTracks") // Maps the method to /api/spotify-search
    public ResponseEntity<String> artistsTopTracks(
            // Use required = false to handle the case where the header might be missing 
            // during initial setup/debug, then check for its presence manually.
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,@RequestHeader(name="id") String id) {

        // --- 1. Validation (Check for Token) ---
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            // If the token is missing or malformed, return 401 explicitly.
            // This is crucial for the frontend's token refresh logic.
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body("{\"error\": \"Missing or invalid Spotify Access Token in Authorization header.\"}");
        }

        // --- 2. Call Service Proxy ---
        try {
            // Forward the validated request to the service layer for the external HTTP call
            ResponseEntity<String> response = spotifyService.getArtistTopTracks(id, authorizationHeader);
            
            // The service handles passing back non-200 statuses (401, 404, etc.)
            return response;
            
        } catch (Exception e) {
            // Catch unexpected runtime errors (e.g., service configuration failure)
            System.err.println("Unexpected error during Spotify search proxy: " + e.getMessage());
            return ResponseEntity
                    .internalServerError()
                    .body("{\"error\": \"Backend proxy failed due to internal error: " + e.getMessage() + "\"}");
        }
    }
 /**
     * Endpoint pour récupérer les albums principaux d'un artiste spécifique
     * en utilisant l'ID de l'artiste.
     * URL d'appel côté frontend: GET /api/spotify/artists/{artistId}/albums
     * * @param artistId L'ID Spotify de l'artiste (extrait du chemin de l'URL).
     * @param authorizationHeader Le jeton d'accès (Bearer token) passé par le frontend (extrait du Header).
     * @return ResponseEntity<String> contenant les données des albums ou une erreur.
     */
    @GetMapping("/artists/{artistId}/albums")
    public ResponseEntity<String> getArtistAlbumsController(
            @PathVariable String artistId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        
        System.out.println("-> Contrôleur appelé: getArtistAlbumsController pour l'artiste ID: " + artistId);

        // Appelle la méthode de service mise à jour, utilisant la nouvelle signature.
        return spotifyService.getArtistAlbums(artistId, authorizationHeader);
    }
    /**
     * Endpoint pour récupérer les pistes (tracks) d'un album spécifique.
     * URL d'appel côté frontend: GET /api/spotify/albums/{albumId}/tracks
     * * @param albumId L'ID Spotify de l'album (extrait du chemin de l'URL).
     * @param authorizationHeader Le jeton d'accès (Bearer token) passé par le frontend.
     * @return ResponseEntity<String> contenant les données des pistes ou une erreur.
     */
    @GetMapping("/albums/{albumId}/tracks")
    public ResponseEntity<String> getAlbumTracksController(
            @PathVariable String albumId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        
        System.out.println("-> Contrôleur appelé: getAlbumTracksController pour l'album ID: " + albumId);

        // Appelle la méthode de service nouvellement créée.
        return spotifyService.getAlbumTracks(albumId, authorizationHeader);
    }
}