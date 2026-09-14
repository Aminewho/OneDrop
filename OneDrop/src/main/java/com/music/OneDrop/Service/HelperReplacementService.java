package com.music.OneDrop.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

@Service
public class HelperReplacementService {

    private static final Logger log = LoggerFactory.getLogger(HelperReplacementService.class);
    private static final String LOCALAPPDATA_ENV = "LOCALAPPDATA";

    private static final Path LOCAL_TOOLS_DIR = Paths.get(
            System.getenv(LOCALAPPDATA_ENV) != null && !System.getenv(LOCALAPPDATA_ENV).isBlank()
                    ? System.getenv(LOCALAPPDATA_ENV)
                    : System.getProperty("user.home") + "\\AppData\\Local",
            "OneDrop",
            "tools"
    );

    private static final Path CURRENT_HELPER = LOCAL_TOOLS_DIR.resolve("yt-helper.exe");
    private static final Path BACKUP_HELPER = LOCAL_TOOLS_DIR.resolve("yt-helper.exe.backup");
    private static final Path INSTALL_TOOLS_DIR = Paths.get(System.getProperty("user.dir")).resolve("tools");

    private final HelperVersionClient helperVersionClient;

    public HelperReplacementService(HelperVersionClient helperVersionClient) {
        this.helperVersionClient = helperVersionClient;
    }

    public boolean replaceAndRestart(Path downloadedFile) {
        try {
            if (downloadedFile == null || !Files.exists(downloadedFile)) {
                log.error("[HelperReplacementService] downloaded helper file not found: {}", downloadedFile);
                return false;
            }

            Files.createDirectories(LOCAL_TOOLS_DIR);

            log.info("[HelperReplacementService] phase 6 starting: stopping old helper, replacing executable, restarting");

            stopCurrentHelper();
            backupCurrentHelper();

            Files.copy(downloadedFile, CURRENT_HELPER, StandardCopyOption.REPLACE_EXISTING);
            Files.deleteIfExists(downloadedFile);

            log.info("[HelperReplacementService] copied new helper into place: {}", CURRENT_HELPER);

            if (startHelper()) {
                Files.deleteIfExists(BACKUP_HELPER);
                log.info("[HelperReplacementService] helper replaced and restarted successfully");
                return true;
            }

            log.error("[HelperReplacementService] restart failed; restoring backup helper");
            restoreBackup();
            return false;

        } catch (Exception e) {
            log.error("[HelperReplacementService] failed during helper replacement: {}", e.getMessage());
            try {
                restoreBackup();
            } catch (Exception restoreException) {
                log.error("[HelperReplacementService] restore backup failed: {}", restoreException.getMessage());
            }
            return false;
        }
    }

    private void pipeHelperOutput(Process process) {
        Thread reader = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = r.readLine()) != null) {
                    log.info("[yt-helper] {}", line);
                }
            } catch (IOException ignored) {
                // helper process ended, stream closed
            }
        });
        reader.setDaemon(true);
        reader.start();
    }

    private void backupCurrentHelper() throws IOException {
        if (Files.exists(CURRENT_HELPER)) {
            Files.copy(CURRENT_HELPER, BACKUP_HELPER, StandardCopyOption.REPLACE_EXISTING);
            log.info("[HelperReplacementService] backed up current helper to: {}", BACKUP_HELPER);
        }
    }

    private void restoreBackup() {
        try {
            if (Files.exists(BACKUP_HELPER)) {
                Files.copy(BACKUP_HELPER, CURRENT_HELPER, StandardCopyOption.REPLACE_EXISTING);
                log.info("[HelperReplacementService] restored backup helper: {}", CURRENT_HELPER);
                startHelper();
            }
        } catch (Exception e) {
            log.error("[HelperReplacementService] could not restore backup helper: {}", e.getMessage());
        }
    }

    private boolean stopCurrentHelper() {
        try {
            if (helperVersionClient.getLocalVersion().isEmpty()) {
                log.info("[HelperReplacementService] no running helper detected on port 8082; skipping stop step");
                return true;
            }

            log.info("[HelperReplacementService] stopping running helper process");
            Process process = new ProcessBuilder(
                    "cmd",
                    "/c",
                    "taskkill /F /IM yt-helper.exe > nul 2>&1"
            ).start();

            int exitCode = process.waitFor();
            log.info("[HelperReplacementService] taskkill exit code: {}", exitCode);

            for (int attempt = 1; attempt <= 20; attempt++) {
                if (helperVersionClient.getLocalVersion().isEmpty()) {
                    log.info("[HelperReplacementService] helper has stopped responding on port 8082");
                    return true;
                }

                try {
                    Thread.sleep(300);
                } catch (InterruptedException interruptedException) {
                    Thread.currentThread().interrupt();
                    log.warn("[HelperReplacementService] helper stop wait interrupted", interruptedException);
                    return false;
                }
            }

            log.warn("[HelperReplacementService] helper still responded after taskkill; proceeding anyway");
            return true;

        } catch (Exception e) {
            log.error("[HelperReplacementService] failed to stop existing helper: {}", e.getMessage());
            return false;
        }
    }

    private boolean startHelper() {
        try {
            if (!Files.exists(CURRENT_HELPER)) {
                log.error("[HelperReplacementService] cannot start helper because target executable is missing: {}", CURRENT_HELPER);
                return false;
            }

            ProcessBuilder pb = new ProcessBuilder(CURRENT_HELPER.toAbsolutePath().toString());
            pb.directory(LOCAL_TOOLS_DIR.toFile());
            pb.environment().put("ONE_DROP_INSTALL_TOOLS_DIR", INSTALL_TOOLS_DIR.toAbsolutePath().toString());
            pb.redirectErrorStream(true);
            Process process = pb.start();
            pipeHelperOutput(process);

            log.info("[HelperReplacementService] started yt-helper.exe from: {}", CURRENT_HELPER);
            log.info("[HelperReplacementService] waiting for helper to answer on port 8082");

            for (int attempt = 1; attempt <= 10; attempt++) {
                Optional<String> version = helperVersionClient.getLocalVersion();
                if (version.isPresent()) {
                    log.info("[HelperReplacementService] verified helper is responding on port 8082, version={}", version.get());
                    return true;
                }
                try {
                    Thread.sleep(800);
                } catch (InterruptedException interruptedException) {
                    Thread.currentThread().interrupt();
                    log.warn("[HelperReplacementService] helper startup wait interrupted", interruptedException);
                    return false;
                }
            }

            log.error("[HelperReplacementService] helper process started but did not become healthy within timeout");
            return false;

        } catch (Exception e) {
            log.error("[HelperReplacementService] failed to start helper: {}", e.getMessage());
            return false;
        }
    }
}
