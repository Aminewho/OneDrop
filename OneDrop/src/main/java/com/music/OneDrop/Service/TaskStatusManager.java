package com.music.OneDrop.Service;
// Nouveau fichier : TaskStatusManager.java (Singleton ou @Service)

import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

@Service
public class TaskStatusManager {

    public enum Status {
        PENDING, DOWNLOADING, SEPARATING, FAILED, COMPLETED
    }
    
    // Map pour stocker l'état de chaque tâche par ID de vidéo
    private final Map<String, Status> taskStatuses = new ConcurrentHashMap<>();

    public void updateStatus(String videoId, Status status) {
        taskStatuses.put(videoId, status);
        System.out.println("STATUS UPDATE for " + videoId + ": " + status);
    }

    public Status getStatus(String videoId) {
        return taskStatuses.getOrDefault(videoId, Status.PENDING);
    }

    public void removeTask(String videoId) {
        taskStatuses.remove(videoId);
    }
}