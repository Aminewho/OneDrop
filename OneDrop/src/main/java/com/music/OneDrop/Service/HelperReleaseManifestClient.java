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
public class HelperReleaseManifestClient {

    private static final String REMOTE_MANIFEST_URL =
"https://github.com/Aminewho/OneDrop/releases/latest/download/version.json";
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Optional<HelperManifest> fetchRemoteManifest() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(REMOTE_MANIFEST_URL))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            System.out.println("[HelperReleaseManifestClient] GitHub version.json HTTP status: " + response.statusCode());
            System.out.println("[HelperReleaseManifestClient] GitHub version.json body: " + response.body());

            if (response.statusCode() != 200) {
                return Optional.empty();
            }

            var root = objectMapper.readTree(response.body());

            String version = root.path("version").asText(null);
            String downloadUrl = root.path("downloadUrl").asText(null);
            String sha256 = root.path("sha256").asText(null);

            System.out.println("[HelperReleaseManifestClient] parsed remote version: " + version);
            System.out.println("[HelperReleaseManifestClient] parsed remote downloadUrl: " + downloadUrl);
            System.out.println("[HelperReleaseManifestClient] parsed remote sha256: " + sha256);

            if (version == null || version.isBlank()
                    || downloadUrl == null || downloadUrl.isBlank()
                    || sha256 == null || sha256.isBlank()) {
                return Optional.empty();
            }

            return Optional.of(new HelperManifest(version, downloadUrl, sha256));

        } catch (Exception e) {
            System.err.println("[HelperReleaseManifestClient] failed to load GitHub version manifest: " + e.getMessage());
            return Optional.empty();
        }
    }

    public record HelperManifest(String version, String downloadUrl, String sha256) {
    }
}
