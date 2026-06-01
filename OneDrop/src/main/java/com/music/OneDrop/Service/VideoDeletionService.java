package com.music.OneDrop.Service;

import com.music.OneDrop.repository.VideoRepository;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.stream.Stream;

import com.music.OneDrop.Service.TaskStatusManager;
import com.music.OneDrop.Service.TaskStatusManager.Status;

@Service
public class VideoDeletionService {

    private static final String APP_NAME = "OneDrop";
    private static final Path USER_DATA_DIR;
    private static final Path TRACKS_DIR;

    static {
        String localAppData = System.getenv("LOCALAPPDATA");
        if (localAppData != null && !localAppData.isBlank()) {
            USER_DATA_DIR = Paths.get(localAppData, APP_NAME);
        } else {
            USER_DATA_DIR = Paths.get(System.getProperty("user.home"), "AppData", "Local", APP_NAME);
        }
        TRACKS_DIR = USER_DATA_DIR.resolve("tracks");
    }

    private final TaskStatusManager statusManager;
    private final VideoRepository videoRepository;

    public VideoDeletionService(TaskStatusManager statusManager, VideoRepository videoRepository) {
        this.statusManager = statusManager;
        this.videoRepository = videoRepository;
    }

    public void deleteVideo(String videoId) throws IOException {
        if (videoId == null || videoId.isBlank()) {
            throw new IllegalArgumentException("videoId is required for deletion.");
        }

        Status currentStatus = statusManager.getStatus(videoId);
        if (currentStatus != null && currentStatus != Status.FAILED && currentStatus != Status.COMPLETED) {
            throw new IllegalStateException("Cannot delete video while processing is " + currentStatus + ".");
        }

        if (!videoRepository.existsById(videoId)) {
            throw new IllegalArgumentException("Video not found: " + videoId);
        }

        Path videoTracksFolder = TRACKS_DIR.resolve(videoId);
        if (Files.exists(videoTracksFolder)) {
            deleteDirectoryRecursively(videoTracksFolder);
            System.out.println("Deleted audio tracks directory: " + videoTracksFolder.toAbsolutePath());
        }

        videoRepository.deleteById(videoId);
        statusManager.removeTask(videoId);
        System.out.println("Deleted DB entry and audio files for videoId: " + videoId);
    }

    private void deleteDirectoryRecursively(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            return;
        }

        try (Stream<Path> paths = Files.walk(directory)) {
            paths.sorted(Comparator.reverseOrder())
                 .forEach(path -> {
                     try {
                         Files.delete(path);
                     } catch (IOException e) {
                         throw new UncheckedIOException("Failed to delete path: " + path, e);
                     }
                 });
        } catch (UncheckedIOException e) {
            throw e.getCause();
        }
    }
}
