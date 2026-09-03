package com.music.OneDrop.Service;

import com.music.OneDrop.Dto.VideoDto;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.io.IOException;
import java.net.Socket;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
            System.out.println("yt-helper is already running on port 8082.");
            return;
        }

        try {
            Path helperPath = DEFAULT_TOOLS_DIR.resolve("yt-helper.exe");
            File helperExe = helperPath.toFile();
            if (helperExe.exists()) {
                ProcessBuilder pb = new ProcessBuilder(helperExe.getAbsolutePath());
                pb.directory(DEFAULT_TOOLS_DIR.toFile());
                pb.redirectErrorStream(true);
                this.helperProcess = pb.start();
                System.out.println("Started yt-helper from " + helperExe.getAbsolutePath());
                try { Thread.sleep(300); } catch (InterruptedException ignored) {}
            } else {
                System.err.println("yt-helper.exe not found at: " + helperExe.getAbsolutePath());
            }
        } catch (Exception e) {
            System.err.println("Could not start yt-helper: " + e.getMessage());
        }
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