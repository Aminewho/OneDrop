package com.music.OneDrop.Service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.HttpClientErrorException; // <-- Import this!
import org.springframework.web.client.HttpServerErrorException; // <-- Import this!

@Service
public class SpotifyService {

    // 🚨 Final Base URL requested by the user
    private static final String SPOTIFY_API_BASE = "https://api.spotify.com/v1/";
    private final RestTemplate restTemplate;

    public SpotifyService() {
        // You may want to configure RestTemplate more robustly in a @Configuration class,
        // but this simple initialization is fine for now.
        this.restTemplate = new RestTemplate();
    }

    public ResponseEntity<String> searchSpotifyCatalog(String query, String authorizationHeader) {
        
        // 1. Build the target URL (must include the correct path: /search)
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(SPOTIFY_API_BASE + "/search")
            .queryParam("q", query)
            .queryParam("type", "track,artist,album") // Using all types for comprehensive search
            .queryParam("limit", 10);

        // 2. Prepare the headers (forward the Authorization header from the client)
        HttpHeaders headers = new HttpHeaders();
        // The authorizationHeader should be "Bearer <token>"
        headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);

        // 3. Create the HTTP entity (request body is null for GET)
        HttpEntity<String> entity = new HttpEntity<>(headers);

        // 4. Make the server-to-server call to the API endpoint
        try {
            // This will throw HttpClientErrorException (for 4xx) or HttpServerErrorException (for 5xx)
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.GET,
                entity,
                String.class
            );

            // If successful (status 200), return the entire response
            return spotifyResponse;
            
        } catch (HttpClientErrorException e) {
            // 🚨 CRITICAL FIX: Catch 4xx errors (like 401) and forward them with the body
            // This ensures the frontend receives the 401 status to trigger a token refresh
            System.err.println("Spotify API Client Error: Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
            
        } catch (HttpServerErrorException e) {
            // Catch 5xx errors and forward them
            System.err.println("Spotify API Server Error: Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());

        } catch (Exception e) {
            // Catch any other exceptions (e.g., network issues)
            System.err.println("Unexpected error during Spotify proxy call: " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
        }
    }
}