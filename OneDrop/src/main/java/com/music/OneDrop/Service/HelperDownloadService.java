package com.music.OneDrop.Service;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.Optional;

@Service
public class HelperDownloadService {

    private static final Duration DOWNLOAD_TIMEOUT = Duration.ofSeconds(120);

    private static final Path LOCAL_TOOLS_DIR = Paths.get(
            System.getenv("LOCALAPPDATA") != null && !System.getenv("LOCALAPPDATA").isBlank()
                    ? System.getenv("LOCALAPPDATA")
                    : System.getProperty("user.home") + "\\AppData\\Local",
            "OneDrop",
            "tools"
    );

    private static final Path DOWNLOAD_TARGET = LOCAL_TOOLS_DIR.resolve("yt-helper.exe.download");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final HelperHashVerifierService helperHashVerifierService;

    public HelperDownloadService(HelperHashVerifierService helperHashVerifierService) {
        this.helperHashVerifierService = helperHashVerifierService;
    }

    public Optional<Path> downloadHelper(String downloadUrl, String expectedSha256) {
        try {
            if (downloadUrl == null || downloadUrl.isBlank()) {
                System.err.println("[HelperDownloadService] downloadUrl is missing");
                return Optional.empty();
            }

            Files.createDirectories(LOCAL_TOOLS_DIR);

            // A prior run may have been killed (e.g. app closed) right after
            // downloading but before the replacement finished. Reuse a
            // leftover download instead of re-fetching it if it already
            // matches, so an interrupted update resumes instead of getting
            // stuck forever.
            if (Files.exists(DOWNLOAD_TARGET)
                    && helperHashVerifierService.verifyDownloadedHelper(DOWNLOAD_TARGET, expectedSha256)) {
                System.out.println("[HelperDownloadService] reusing already-downloaded, hash-verified file: " + DOWNLOAD_TARGET);
                return Optional.of(DOWNLOAD_TARGET);
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(downloadUrl))
                    .timeout(DOWNLOAD_TIMEOUT)
                    .GET()
                    .build();

            HttpResponse<byte[]> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofByteArray()
            );

            System.out.println("[HelperDownloadService] download HTTP status: " + response.statusCode());

            if (response.statusCode() != 200) {
                System.err.println("[HelperDownloadService] download failed with HTTP status " + response.statusCode());
                return Optional.empty();
            }

            byte[] fileBytes = response.body();
            Files.deleteIfExists(DOWNLOAD_TARGET);
            Files.write(DOWNLOAD_TARGET, fileBytes);

            System.out.println("[HelperDownloadService] downloaded yt-helper.exe.download to: " + DOWNLOAD_TARGET);
            System.out.println("[HelperDownloadService] downloaded bytes: " + fileBytes.length);

            return Optional.of(DOWNLOAD_TARGET);

        } catch (Exception e) {
            System.err.println("[HelperDownloadService] failed to download helper: " + e.getMessage());
            return Optional.empty();
        }
    }
}
