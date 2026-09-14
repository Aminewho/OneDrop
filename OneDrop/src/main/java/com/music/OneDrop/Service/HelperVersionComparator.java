package com.music.OneDrop.Service;

import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class HelperVersionComparator {

    public boolean isRemoteVersionNewer(String localVersion, String remoteVersion) {
        if (localVersion == null || localVersion.isBlank() || remoteVersion == null || remoteVersion.isBlank()) {
            return false;
        }

        int[] local = parseSemver(localVersion);
        int[] remote = parseSemver(remoteVersion);

        if (local == null || remote == null) {
            return false;
        }

        for (int i = 0; i < 3; i++) {
            if (remote[i] > local[i]) {
                return true;
            }
            if (remote[i] < local[i]) {
                return false;
            }
        }

        return false;
    }

    private int[] parseSemver(String version) {
        String normalized = version.trim();

        if (normalized.startsWith("v") || normalized.startsWith("V")) {
            normalized = normalized.substring(1);
        }

        String[] parts = normalized.split("\\.", -1);
        if (parts.length < 3) {
            return null;
        }

        int[] result = new int[3];
        for (int i = 0; i < 3; i++) {
            String part = parts[i].trim();
            if (part.isEmpty()) {
                return null;
            }
            try {
                result[i] = Integer.parseInt(part);
            } catch (NumberFormatException e) {
                return null;
            }
        }

        return result;
    }
}
