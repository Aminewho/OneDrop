package com.music.OneDrop.Service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.HttpClientErrorException; // <-- Import this!
import org.springframework.web.client.HttpServerErrorException; // <-- Import this!
@Service
public class SpotifyService {

    private static final Logger logger = LoggerFactory.getLogger(SpotifyService.class);

    // 🚨 Final Base URL requested by the user
    private static final String SPOTIFY_API_BASE = "https://api.spotify.com/v1/";
    private static final String SPOTIFY_API_V1 = "https://api.spotify.com/v1";
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
    // =========================================================================
    // 2. NEW FUNCTION (Get User Profile)
    // =========================================================================
    /**
     * Fetches the current user's profile information from the Spotify API.
     * @param authorizationHeader The 'Bearer <token>' header from the client.
     * @return ResponseEntity containing the user's profile JSON or an error status.
     */
    public ResponseEntity<String> getUserProfile(String authorizationHeader) {
        
        // Target URL: https://api.spotify.com/v1/me
        String targetUrl = SPOTIFY_API_V1 + "/me";

        // Prepare the headers (forward the Authorization header)
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);
        
        // Create the HTTP entity
        HttpEntity<String> entity = new HttpEntity<>(headers);

        // Make the server-to-server call
        try {
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                targetUrl,
                HttpMethod.GET,
                entity,
                String.class
            );
            return spotifyResponse;
            
        } catch (HttpClientErrorException e) {
            System.err.println("Spotify API Client Error (Profile): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
            
        } catch (Exception e) {
            System.err.println("Unexpected error during Profile proxy call: " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect for profile.\"}");
        }
    }
      // =========================================================================
    // 2. NEW FUNCTION (Get top Artists)
    // =========================================================================
    /**
     * Fetches the current user's profile information from the Spotify API.
     * @param authorizationHeader The 'Bearer <token>' header from the client.
     * @return ResponseEntity containing the user's profile JSON or an error status.
     */
    public ResponseEntity<String> getTopArtists(String authorizationHeader) {
        
        // Target URL: https://api.spotify.com/v1/me
        String targetUrl = SPOTIFY_API_V1 + "/me/top/artists";

        // Prepare the headers (forward the Authorization header)
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);
        
        // Create the HTTP entity
        HttpEntity<String> entity = new HttpEntity<>(headers);

        // Make the server-to-server call
        try {
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                targetUrl,
                HttpMethod.GET,
                entity,
                String.class
            );
            return spotifyResponse;
            
        } catch (HttpClientErrorException e) {
            System.err.println("Spotify API Client Error (top artists): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
            
        } catch (Exception e) {
            System.err.println("Unexpected error during Profile proxy call: " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect for profile.\"}");
        }
    }
      // 2. NEW FUNCTION (Get top Artists)
    // =========================================================================
    /**
     * Fetches the current user's profile information from the Spotify API.
     * @param authorizationHeader The 'Bearer <token>' header from the client.
     * @return ResponseEntity containing the user's profile JSON or an error status.
     */
    public ResponseEntity<String> getFollowing(String authorizationHeader) {
        
        // Target URL: https://api.spotify.com/v1/me
        String targetUrl = SPOTIFY_API_V1 + "/me/following?type=artist&limit=40";

        // Prepare the headers (forward the Authorization header)
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);
        
        // Create the HTTP entity
        HttpEntity<String> entity = new HttpEntity<>(headers);

        // Make the server-to-server call
        try {
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                targetUrl,
                HttpMethod.GET,
                entity,
                String.class
            );
            return spotifyResponse;
            
        } catch (HttpClientErrorException e) {
            System.err.println("Spotify API Client Error (following): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
            
        } catch (Exception e) {
            System.err.println("Unexpected error during Profile proxy call: " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect for profile.\"}");
        }
    }
        
     public ResponseEntity<String> getArtistTopTracks(String artistId, String authorizationHeader) {
        
        // Build the target URL: https://api.spotify.com/v1/artists/{id}/top-tracks
        String targetUrl = SPOTIFY_API_V1 + "/artists/" + artistId + "/top-tracks";
         logger.info("target URL for artist top tracks: " + targetUrl);
        // Spotify's top-tracks endpoint requires a country parameter
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(targetUrl)
            .queryParam("limit", "10");
        logger.info("Built URL for artist top tracks: " + builder.toUriString());
        // 2. Prepare the headers (forward the Authorization header from the client)
        HttpHeaders headers = new HttpHeaders();
        // The authorizationHeader should be "Bearer <token>"
        headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);
        headers.set(HttpHeaders.CONTENT_TYPE, "application/json");  
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
            // Forward 4xx errors with body
            System.err.println("Spotify API Client Error (artist top tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
            
        } catch (HttpServerErrorException e) {
            // Catch 5xx errors and forward them
            System.err.println("Spotify API Server Error (artist top tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());

        } catch (Exception e) {
            // Catch any other exceptions (e.g., network issues)
            System.err.println("Unexpected error during Spotify proxy call (artist top tracks): " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
        }
    }
    public ResponseEntity<String> getArtistAlbums(String artistId, String authorizationHeader) {
        
    // Build the target URL: /artists/{id}/albums
    String targetUrl = SPOTIFY_API_V1 + "/artists/" + artistId + "/albums";
    logger.info("Target URL for artist albums: " + targetUrl);
    
    // Spotify's artists albums endpoint requires a country/market parameter and grouping
    UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(targetUrl)
        .queryParam("include_groups", "album,single,compilation") // Include common album types
        .queryParam("market", "US") // Specify market for availability
        .queryParam("limit", 50); // Fetch up to 50 albums/singles

    logger.info("Built URL for artist albums: " + builder.toUriString());
    
    // 2. Prepare the headers (forward the Authorization header from the client)
    HttpHeaders headers = new HttpHeaders();
    // The authorizationHeader should be "Bearer <token>"
    headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);
    headers.set(HttpHeaders.CONTENT_TYPE, "application/json");  
    
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
        // Forward 4xx errors with body
        System.err.println("Spotify API Client Error (artist albums): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
        return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        
    } catch (HttpServerErrorException e) {
        // Catch 5xx errors and forward them
        System.err.println("Spotify API Server Error (artist albums): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
        return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());

    } catch (Exception e) {
        // Catch any other exceptions (e.g., network issues)
        System.err.println("Unexpected error during Spotify proxy call (artist albums): " + e.getMessage());
        return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
    }
}


public ResponseEntity<String> getAlbumTracks(String albumId, String authorizationHeader) {
        
    // Build the target URL: /albums/{id}/tracks
    String targetUrl = SPOTIFY_API_V1 + "/albums/" + albumId + "/tracks";
    logger.info("Target URL for album tracks: " + targetUrl);
    
    // Spotify's endpoint for album tracks
    UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(targetUrl)
        .queryParam("market", "US") // Specify market for availability
        .queryParam("limit", 50); // Fetch up to 50 tracks

    logger.info("Built URL for album tracks: " + builder.toUriString());
    
    // 2. Prepare the headers (forward the Authorization header from the client)
    HttpHeaders headers = new HttpHeaders();
    headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);
    headers.set(HttpHeaders.CONTENT_TYPE, "application/json"); 
    
    // 3. Create the HTTP entity (request body is null for GET)
    HttpEntity<String> entity = new HttpEntity<>(headers);

    // 4. Make the server-to-server call to the API endpoint
    try {
        ResponseEntity<String> spotifyResponse = restTemplate.exchange(
            builder.toUriString(),
            HttpMethod.GET,
            entity,
            String.class
        );

        // If successful (status 200), return the entire response
        return spotifyResponse;
        
    } catch (HttpClientErrorException e) {
        // Forward 4xx errors with body
        System.err.println("Spotify API Client Error (album tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
        return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        
    } catch (HttpServerErrorException e) {
        // Catch 5xx errors and forward them
        System.err.println("Spotify API Server Error (album tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
        return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());

    } catch (Exception e) {
        // Catch any other exceptions (e.g., network issues)
        System.err.println("Unexpected error during Spotify proxy call (album tracks): " + e.getMessage());
        return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
    }
}
}