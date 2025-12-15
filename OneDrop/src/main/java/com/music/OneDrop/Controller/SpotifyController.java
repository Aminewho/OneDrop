package com.music.OneDrop.Controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
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
}