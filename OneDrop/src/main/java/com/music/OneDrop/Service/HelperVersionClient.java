package com.music.OneDrop.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

@Service
public class HelperVersionClient {

    private static final String HELPER_BASE_URL = "http://127.0.0.1:8082";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Optional<String> getLocalVersion() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(HELPER_BASE_URL + "/version"))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            System.out.println("[HelperVersionClient] local helper /version HTTP status: " + response.statusCode());
            System.out.println("[HelperVersionClient] local helper /version body: " + response.body());

            if (response.statusCode() != 200) {
                return Optional.empty();
            }

            var root = objectMapper.readTree(response.body());
            String version = root.path("version").asText(null);

            System.out.println("[HelperVersionClient] parsed local helper version: " + version);

            return (version == null || version.isBlank())
                    ? Optional.empty()
                    : Optional.of(version);

        } catch (Exception e) {
            System.err.println("[HelperVersionClient] failed to read local helper version: " + e.getMessage());
            return Optional.empty();
        }
    }
}
