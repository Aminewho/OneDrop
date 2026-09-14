package com.music.OneDrop.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Optional;

@Service
public class HelperHashVerifierService {

    private static final Logger log = LoggerFactory.getLogger(HelperHashVerifierService.class);

    public Optional<String> computeSha256(Path file) {
        try {
            if (file == null || !Files.exists(file)) {
                log.error("[HelperHashVerifierService] file not found for SHA-256: {}", file);
                return Optional.empty();
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            try (InputStream inputStream = Files.newInputStream(file)) {
                byte[] buffer = new byte[8192];
                int read;

                while ((read = inputStream.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }

            byte[] hashBytes = digest.digest();
            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }

            log.info("[HelperHashVerifierService] computed SHA-256 for {}: {}", file, hex);
            return Optional.of(hex.toString());

        } catch (Exception e) {
            log.error("[HelperHashVerifierService] failed to compute SHA-256 for {}: {}", file, e.getMessage());
            return Optional.empty();
        }
    }

    public boolean verifyDownloadedHelper(Path downloadedFile, String expectedSha256) {
        if (downloadedFile == null || expectedSha256 == null || expectedSha256.isBlank()) {
            log.error("[HelperHashVerifierService] verification aborted: missing downloaded file or expected SHA-256");
            return false;
        }

        log.info("[HelperHashVerifierService] expected SHA-256 from version.json: {}", expectedSha256);

        Optional<String> actualSha256Opt = computeSha256(downloadedFile);

        if (actualSha256Opt.isEmpty()) {
            log.error("[HelperHashVerifierService] verification failed: could not compute actual SHA-256");
            return false;
        }

        String actualSha256 = actualSha256Opt.get();
        String expectedLower = expectedSha256.toLowerCase(Locale.ROOT);
        String actualLower = actualSha256.toLowerCase(Locale.ROOT);

        log.info("[HelperHashVerifierService] comparison => expected={} | actual={}", expectedLower, actualLower);

        boolean matches = actualSha256.equalsIgnoreCase(expectedSha256);

        if (matches) {
            log.info("[HelperHashVerifierService] SHA-256 comparison result: MATCH");
        } else {
            log.error("[HelperHashVerifierService] SHA-256 comparison result: MISMATCH");
        }

        return matches;
    }
}
