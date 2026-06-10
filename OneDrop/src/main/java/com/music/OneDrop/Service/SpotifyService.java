package com.music.OneDrop.Service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.HttpClientErrorException; // <-- Import this!
import org.springframework.web.client.HttpServerErrorException; // <-- Import this!
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import java.util.Map;
@Service
public class SpotifyService {

    private static final Logger logger = LoggerFactory.getLogger(SpotifyService.class);

    private static final String SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
    private static final String SPOTIFY_API_V1 = "https://api.spotify.com/v1";
    private static final String SPOTIFY_CLIENT_ID = System.getenv("SPOTIFY_CLIENT_ID");
    private static final String SPOTIFY_CLIENT_SECRET = System.getenv("SPOTIFY_CLIENT_SECRET");

    private volatile String appAccessToken = null;
    private volatile long appAccessTokenExpiresAt = 0;
    private final RestTemplate restTemplate;

    public SpotifyService() {
        // You may want to configure RestTemplate more robustly in a @Configuration class,
        // but this simple initialization is fine for now.
        this.restTemplate = new RestTemplate();
    }

    public ResponseEntity<String> searchSpotifyCatalog(String query) {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(SPOTIFY_API_V1 + "/search")
            .queryParam("q", encodedQuery)
            .queryParam("type", "track,artist")
            .queryParam("limit", 20);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAppAccessToken());
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                builder.build(true).toUriString(),
                HttpMethod.GET,
                entity,
                String.class
            );
            return spotifyResponse;
        } catch (HttpClientErrorException e) {
            System.err.println("Spotify API Client Error: Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (HttpServerErrorException e) {
            System.err.println("Spotify API Server Error: Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            System.err.println("Unexpected error during Spotify proxy call: " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
        }
    }

    private synchronized String getAppAccessToken() {
        if (appAccessToken != null && System.currentTimeMillis() + 60000 < appAccessTokenExpiresAt) {
            return appAccessToken;
        }

        if (SPOTIFY_CLIENT_ID == null || SPOTIFY_CLIENT_ID.isEmpty() || SPOTIFY_CLIENT_SECRET == null || SPOTIFY_CLIENT_SECRET.isEmpty()) {
            throw new IllegalStateException("Spotify client credentials are not configured in environment variables.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map<String, Object>> tokenResponse = restTemplate.exchange(
                SPOTIFY_TOKEN_URL,
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            if (!tokenResponse.getStatusCode().is2xxSuccessful() || tokenResponse.getBody() == null) {
                throw new IllegalStateException("Spotify token endpoint returned invalid response.");
            }

            Map<String, Object> tokenData = tokenResponse.getBody();
            String accessToken = (String) tokenData.get("access_token");
            Number expiresInNumber = (Number) tokenData.get("expires_in");

            if (accessToken == null || expiresInNumber == null) {
                throw new IllegalStateException("Spotify token endpoint did not return access_token or expires_in.");
            }

            appAccessToken = accessToken;
            appAccessTokenExpiresAt = System.currentTimeMillis() + expiresInNumber.longValue() * 1000L;
            return appAccessToken;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to obtain Spotify client credentials token: " + e.getMessage(), e);
        }
    }
    public ResponseEntity<String> getArtistTopTracks(String artistId) {
        String targetUrl = SPOTIFY_API_V1 + "/artists/" + artistId + "/top-tracks";
        logger.info("target URL for artist top tracks: " + targetUrl);

        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(targetUrl)
            .queryParam("market", "US")
            .queryParam("limit", "10");
        logger.info("Built URL for artist top tracks: " + builder.toUriString());

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAppAccessToken());
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.GET,
                entity,
                String.class
            );
            return spotifyResponse;
        } catch (HttpClientErrorException e) {
            System.err.println("Spotify API Client Error (artist top tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (HttpServerErrorException e) {
            System.err.println("Spotify API Server Error (artist top tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            System.err.println("Unexpected error during Spotify proxy call (artist top tracks): " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
        }
    }

    public ResponseEntity<String> getArtistAlbums(String artistId) {
        String targetUrl = SPOTIFY_API_V1 + "/artists/" + artistId + "/albums";
        logger.info("Target URL for artist albums: " + targetUrl);

        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(targetUrl)
            .queryParam("include_groups", "album,single,compilation")
            .queryParam("market", "US")
            .queryParam("limit", 50);

        logger.info("Built URL for artist albums: " + builder.toUriString());

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAppAccessToken());
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.GET,
                entity,
                String.class
            );
            return spotifyResponse;
        } catch (HttpClientErrorException e) {
            System.err.println("Spotify API Client Error (artist albums): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (HttpServerErrorException e) {
            System.err.println("Spotify API Server Error (artist albums): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            System.err.println("Unexpected error during Spotify proxy call (artist albums): " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
        }
    }

    public ResponseEntity<String> getAlbumTracks(String albumId) {
        String targetUrl = SPOTIFY_API_V1 + "/albums/" + albumId + "/tracks";
        logger.info("Target URL for album tracks: " + targetUrl);

        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(targetUrl)
            .queryParam("market", "US")
            .queryParam("limit", 50);

        logger.info("Built URL for album tracks: " + builder.toUriString());

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAppAccessToken());
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> spotifyResponse = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.GET,
                entity,
                String.class
            );
            return spotifyResponse;
        } catch (HttpClientErrorException e) {
            System.err.println("Spotify API Client Error (album tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (HttpServerErrorException e) {
            System.err.println("Spotify API Server Error (album tracks): Status " + e.getStatusCode() + " - Body: " + e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            System.err.println("Unexpected error during Spotify proxy call (album tracks): " + e.getMessage());
            return ResponseEntity.internalServerError().body("{\"error\": \"Backend proxy failed to connect or unexpected error.\"}");
        }
    }
}