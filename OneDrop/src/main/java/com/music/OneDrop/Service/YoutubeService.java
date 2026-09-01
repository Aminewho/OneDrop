

package com.music.OneDrop.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.services.youtube.YouTube;
import com.google.api.services.youtube.model.SearchListResponse;
import com.google.api.services.youtube.model.SearchResult;
import com.google.api.services.youtube.model.Video;
import com.google.api.services.youtube.model.VideoListResponse;
import com.music.OneDrop.Dto.VideoDto;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigInteger;
import java.net.Socket;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class YoutubeService {

    private final YouTube youTube;

    @Value("${youtube.api.key}")
    private String apiKey;

    public YoutubeService(YouTube youTube) {
        this.youTube = youTube;
    }

    private final RestTemplate restTemplate = new RestTemplate();
    private Process helperProcess;

    private static final long SEARCH_CACHE_TTL_SECONDS = 120;
    private final Map<String, CachedResult> searchCache = new ConcurrentHashMap<>();

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "yt-dlp-updater");
        t.setDaemon(true);
        return t;
    });

    public List<VideoDto> searchVideosWithDetails(String query, long maxResults) throws IOException {
        System.out.println("YoutubeService.searchVideosWithDetails called with query='" + query + "', maxResults=" + maxResults);

        try {
            String key = query + ":" + maxResults;
            CachedResult cached = searchCache.get(key);
            if (cached != null && cached.expiresAt > System.currentTimeMillis()) {
                return cached.results;
            }

            List<VideoDto> r = searchViaYtDlp(query, (int) maxResults);
            searchCache.put(key, new CachedResult(r, System.currentTimeMillis() + SEARCH_CACHE_TTL_SECONDS * 1000));
            return r;
        } catch (Exception e) {
            System.err.println("yt-dlp search failed, falling back to YouTube Data API: " + e.getMessage());
            e.printStackTrace();
        }

        // --- Fallback YouTube Data API ---
        YouTube.Search.List search = youTube.search().list("id");
        search.setKey(apiKey);
        search.setQ(query);
        search.setType("video");
        search.setFields("items/id/videoId");
        search.setMaxResults(maxResults);

        SearchListResponse searchResponse = search.execute();
        List<SearchResult> searchResults = searchResponse.getItems();

        if (searchResults == null || searchResults.isEmpty()) {
            return new ArrayList<>();
        }

        String videoIds = searchResults.stream()
                .map(result -> result.getId().getVideoId())
                .collect(Collectors.joining(","));

        YouTube.Videos.List videoListRequest = youTube.videos().list("snippet,contentDetails,statistics");
        videoListRequest.setKey(apiKey);
        videoListRequest.setId(videoIds);
        videoListRequest.setFields("items(id,snippet(title,channelTitle,publishedAt,thumbnails/default/url),contentDetails/duration,statistics/viewCount)");

        VideoListResponse videoListResponse = videoListRequest.execute();

        return videoListResponse.getItems().stream()
                .map(this::mapToVideoDto)
                .collect(Collectors.toList());
    }

    private static final Path DEFAULT_TOOLS_DIR = Paths.get(System.getProperty("user.dir")).resolve("tools");
    private static final String YTDLP_CMD = DEFAULT_TOOLS_DIR.resolve("yt-dlp.exe").toAbsolutePath().toString();
    private static final long YTDLP_UPDATE_THRESHOLD_DAYS = 30;

    private List<VideoDto> searchViaYtDlp(String query, int maxResults) throws Exception {
        try {
            String url = "http://127.0.0.1:8082/search?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&max_results=" + maxResults;
            VideoDto[] arr = restTemplate.getForObject(url, VideoDto[].class);
            if (arr != null && arr.length > 0) {
                // Formatting view count if FastAPI returns raw number strings
                for (VideoDto dto : arr) {
                    if (dto.getViews() != null && dto.getViews().matches("\\d+")) {
                        dto.setViews(formatViews(Long.parseLong(dto.getViews())));
                    }
                }
                return Arrays.asList(arr);
            }
        } catch (Exception e) {
            System.err.println("yt-helper call failed, falling back to yt-dlp process: " + e.getMessage());
        }

        List<String> command = new ArrayList<>();
        command.add(YTDLP_CMD);
        command.add("ytsearch" + maxResults + ":" + query);
        command.add("--dump-json");
        command.add("--no-download");
        command.add("--no-warnings");

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(DEFAULT_TOOLS_DIR.toFile());
        pb.redirectErrorStream(true);

        Process process = pb.start();
        List<VideoDto> results = new ArrayList<>();
        ObjectMapper mapper = new ObjectMapper();

        try (InputStream is = process.getInputStream(); BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;
                try {
                    JsonNode node = mapper.readTree(line);
                    VideoDto dto = new VideoDto();
                    dto.setVideoId(node.path("id").asText(null));
                    dto.setTitle(node.path("title").asText(null));
                    dto.setChannelTitle(node.path("uploader").asText(null));
                    dto.setThumbnailUrl(node.path("thumbnail").asText(null));

                   
        
                    // 3. Parsing View Count (yt-dlp uses "view_count")
                    JsonNode viewNode = node.has("view_count") ? node.get("view_count") : node.get("viewCount");
                    if (viewNode != null && !viewNode.isNull()) {
                        long viewCount = viewNode.asLong();
                        dto.setViews(formatViews(viewCount));
                    }

                    results.add(dto);
                } catch (Exception ex) {
                    System.err.println("Failed to parse yt-dlp line as JSON: " + ex.getMessage());
                }
            }
        }

        boolean finished = process.waitFor(12, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("yt-dlp search timed out");
        }
        int exit = process.exitValue();
        if (exit != 0) {
            throw new RuntimeException("yt-dlp returned non-zero exit code: " + exit);
        }

        return results;
    }

    private static String secondsToIso(String secondsStr) {
        if (secondsStr == null || secondsStr.isBlank()) return null;
        try {
            long seconds = (long) Double.parseDouble(secondsStr);
            long hrs = seconds / 3600;
            long rem = seconds % 3600;
            long mins = rem / 60;
            long secs = rem % 60;
            StringBuilder sb = new StringBuilder("PT");
            if (hrs > 0) sb.append(hrs).append("H");
            if (mins > 0) sb.append(mins).append("M");
            if (secs > 0 || (hrs == 0 && mins == 0)) sb.append(secs).append("S");
            return sb.toString();
        } catch (NumberFormatException e) {
            return null;
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

    private static void ensureYtDlpUpdated() throws Exception {
        Path ytPath = Paths.get(YTDLP_CMD);
        if (!Files.exists(ytPath)) {
            throw new IOException("yt-dlp not found at: " + ytPath);
        }
        Instant lastModified = Files.getLastModifiedTime(ytPath).toInstant();
        Instant now = Instant.now();
        long daysOld = ChronoUnit.DAYS.between(lastModified, now);
        if (daysOld >= YTDLP_UPDATE_THRESHOLD_DAYS) {
            System.out.println("yt-dlp is " + daysOld + " days old — attempting auto-update...");
            ProcessBuilder updatePb = new ProcessBuilder(YTDLP_CMD, "-U");
            updatePb.directory(DEFAULT_TOOLS_DIR.toFile());
            Process p = updatePb.start();

            Thread outT = new Thread(() -> {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String l; while ((l = r.readLine()) != null) System.out.println("yt-dlp-update: " + l);
                } catch (IOException ignored) {}
            });
            Thread errT = new Thread(() -> {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getErrorStream()))) {
                    String l; while ((l = r.readLine()) != null) System.err.println("yt-dlp-update-err: " + l);
                } catch (IOException ignored) {}
            });
            outT.start(); errT.start();

            boolean finished = p.waitFor(20, TimeUnit.SECONDS);
            if (!finished) {
                p.destroyForcibly();
                System.err.println("yt-dlp auto-update timed out and was killed");
            } else {
                int exit = p.exitValue();
                if (exit != 0) System.err.println("yt-dlp auto-update returned " + exit);
                else System.out.println("yt-dlp auto-update completed successfully");
            }
        }
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
        if (isHelperRunning()) return;

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

    @PostConstruct
    private void scheduleYtDlpUpdater() {
        scheduler.scheduleAtFixedRate(() -> {
            try {
                ensureYtDlpUpdated();
            } catch (Exception e) {
                System.err.println("Scheduled yt-dlp update failed: " + e.getMessage());
            }
        }, 5, 24 * 60, TimeUnit.MINUTES);
    }

    private static class CachedResult {
        final List<VideoDto> results;
        final long expiresAt;

        CachedResult(List<VideoDto> results, long expiresAt) {
            this.results = results;
            this.expiresAt = expiresAt;
        }
    }

    private VideoDto mapToVideoDto(Video video) {
        VideoDto dto = new VideoDto();
        dto.setVideoId(video.getId());

        if (video.getSnippet() != null) {
            dto.setTitle(video.getSnippet().getTitle());
            dto.setChannelTitle(video.getSnippet().getChannelTitle());

            if (video.getSnippet().getThumbnails() != null && video.getSnippet().getThumbnails().getDefault() != null) {
                dto.setThumbnailUrl(video.getSnippet().getThumbnails().getDefault().getUrl());
            }

        
        }

      

        if (video.getStatistics() != null && video.getStatistics().getViewCount() != null) {
            BigInteger viewCount = video.getStatistics().getViewCount();
            dto.setViews(formatViews(viewCount.longValue()));
        }

        return dto;
    }
}