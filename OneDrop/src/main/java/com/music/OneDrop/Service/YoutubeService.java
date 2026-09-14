package com.music.OneDrop.Service;

import com.music.OneDrop.Dto.VideoDto;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.Socket;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class YoutubeService {

    private final RestTemplate restTemplate = new RestTemplate();
    private Process helperProcess;

    private static final long SEARCH_CACHE_TTL_SECONDS = 120;
    private final Map<String, CachedResult> searchCache = new ConcurrentHashMap<>();

    private static final Path DEFAULT_TOOLS_DIR = Paths.get(System.getProperty("user.dir")).resolve("tools");
    private static final Path LOCALAPPDATA_TOOLS_DIR = Paths.get(
            System.getenv("LOCALAPPDATA") != null && !System.getenv("LOCALAPPDATA").isBlank()
                    ? System.getenv("LOCALAPPDATA")
                    : System.getProperty("user.home") + "\\AppData\\Local",
            "OneDrop",
            "tools"
    );
    private static final Path LOCALAPPDATA_HELPER = LOCALAPPDATA_TOOLS_DIR.resolve("yt-helper.exe");
    private static final Path INSTALL_HELPER = DEFAULT_TOOLS_DIR.resolve("yt-helper.exe");

    public List<VideoDto> searchVideosWithDetails(String query, long maxResults) throws IOException {
        System.out.println("YoutubeService.searchVideosWithDetails called with query='" + query + "', maxResults=" + maxResults);

        String key = query + ":" + maxResults;
        CachedResult cached = searchCache.get(key);
        if (cached != null && cached.expiresAt > System.currentTimeMillis()) {
            return cached.results;
        }

        List<VideoDto> results = searchViaYtHelper(query, (int) maxResults);
        if (!results.isEmpty()) {
            searchCache.put(key, new CachedResult(results, System.currentTimeMillis() + SEARCH_CACHE_TTL_SECONDS * 1000));
        }
        return results;
    }

    private List<VideoDto> searchViaYtHelper(String query, int maxResults) {
        try {
            System.out.println("Calling yt-helper service for query: " + query);
            String url = "http://127.0.0.1:8082/search?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&max_results=" + maxResults;
            VideoDto[] arr = restTemplate.getForObject(url, VideoDto[].class);
            if (arr != null && arr.length > 0) {
                for (VideoDto dto : arr) {
                    if (dto.getViews() != null && dto.getViews().matches("\\d+")) {
                        dto.setViews(formatViews(Long.parseLong(dto.getViews())));
                    }
                }
                return Arrays.asList(arr);
            }
        } catch (Exception e) {
            System.err.println("yt-helper call failed: " + e.getMessage());
            e.printStackTrace();
        }
        return new ArrayList<>();
    }

    private boolean isHelperRunning() {
        try (Socket s = new Socket("127.0.0.1", 8082)) {
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    @PostConstruct
    public void startHelper() {
        if (isHelperRunning()) {
            System.out.println("yt-helper already running (likely an orphan from a previous run) — force-killing it before restart.");
            forceKillAnyRunningHelper();
            try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }

        try {
            ensureHelperCopiedToAppData();

            Path helperPath = LOCALAPPDATA_HELPER;
            File helperExe = helperPath.toFile();
            if (helperExe.exists()) {
                ProcessBuilder pb = new ProcessBuilder(helperExe.getAbsolutePath());
                pb.directory(LOCALAPPDATA_TOOLS_DIR.toFile());
                pb.environment().put("ONE_DROP_INSTALL_TOOLS_DIR", DEFAULT_TOOLS_DIR.toAbsolutePath().toString());
                pb.redirectErrorStream(true);
                this.helperProcess = pb.start();
                System.out.println("Started yt-helper from " + helperExe.getAbsolutePath());
                pipeHelperOutput(this.helperProcess);
                waitForHelperVersionEndpoint();
            } else {
                System.err.println("yt-helper.exe not found at: " + helperExe.getAbsolutePath());
            }
        } catch (Exception e) {
            System.err.println("Could not start yt-helper: " + e.getMessage());
        }
    }

    private void pipeHelperOutput(Process process) {
        Thread reader = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = r.readLine()) != null) {
                    System.out.println("[yt-helper] " + line);
                }
            } catch (IOException ignored) {
                // helper process ended, stream closed
            }
        });
        reader.setDaemon(true);
        reader.start();
    }

    private void waitForHelperVersionEndpoint() {
        for (int attempt = 1; attempt <= 20; attempt++) {
            try {
                String url = "http://127.0.0.1:8082/version";
                Map<String, Object> response = restTemplate.getForObject(url, Map.class);
                if (response != null && response.get("version") != null) {
                    System.out.println("yt-helper is ready on port 8082, version=" + response.get("version"));
                    return;
                }
            } catch (Exception ignored) {
                // retry until the helper is ready
            }

            try {
                Thread.sleep(250);
            } catch (InterruptedException interruptedException) {
                Thread.currentThread().interrupt();
                System.err.println("Interrupted while waiting for yt-helper readiness.");
                return;
            }
        }

        System.err.println("yt-helper process started but /version endpoint did not become ready in time.");
    }

    private void ensureHelperCopiedToAppData() throws IOException {
        Files.createDirectories(LOCALAPPDATA_TOOLS_DIR);

        if (Files.exists(LOCALAPPDATA_HELPER)) {
            System.out.println("yt-helper already present in AppData: " + LOCALAPPDATA_HELPER);
            return;
        }

        if (!Files.exists(INSTALL_HELPER)) {
            System.err.println("yt-helper.exe not found in install folder: " + INSTALL_HELPER);
            return;
        }

        Files.copy(INSTALL_HELPER, LOCALAPPDATA_HELPER, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        System.out.println("Copied yt-helper.exe from install folder to AppData: " + LOCALAPPDATA_HELPER);
    }

    @PreDestroy
    public void stopHelper() {
        try {
            if (this.helperProcess != null && this.helperProcess.isAlive()) {
                this.helperProcess.destroy();
                this.helperProcess.waitFor(2, TimeUnit.SECONDS);
            }
        } catch (Exception e) {
            System.err.println("Error stopping yt-helper: " + e.getMessage());
        }
        forceKillAnyRunningHelper();
    }

    /**
     * this.helperProcess only refers to a process spawned by this JVM instance.
     * An orphan left behind by a previous run (e.g. after a hard kill from the
     * Electron shell) has no Java handle here, so it must be killed by image
     * name instead — the same approach HelperReplacementService uses.
     */
    private void forceKillAnyRunningHelper() {
        try {
            Process process = new ProcessBuilder(
                    "cmd", "/c", "taskkill /F /IM yt-helper.exe > nul 2>&1"
            ).start();
            process.waitFor(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            System.err.println("Failed to force-kill existing yt-helper.exe: " + e.getMessage());
        }
    }

    private static String formatViews(long count) {
        if (count >= 1_000_000_000) {
            return String.format("%.1fB vues", count / 1_000_000_000.0);
        } else if (count >= 1_000_000) {
            return String.format("%.1fM vues", count / 1_000_000.0);
        } else if (count >= 1_000) {
            return String.format("%.1fK vues", count / 1_000.0);
        }
        return count + " vues";
    }

    private static class CachedResult {
        final List<VideoDto> results;
        final long expiresAt;

        CachedResult(List<VideoDto> results, long expiresAt) {
            this.results = results;
            this.expiresAt = expiresAt;
        }
    }
}