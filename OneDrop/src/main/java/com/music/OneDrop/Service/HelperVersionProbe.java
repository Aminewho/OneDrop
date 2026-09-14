package com.music.OneDrop.Service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class HelperVersionProbe {

    private static final Logger log = LoggerFactory.getLogger(HelperVersionProbe.class);

    private final HelperVersionChecker helperVersionChecker;
    private final HelperDownloadService helperDownloadService;
    private final HelperHashVerifierService helperHashVerifierService;
    private final HelperReplacementService helperReplacementService;

    public HelperVersionProbe(
            HelperVersionChecker helperVersionChecker,
            HelperDownloadService helperDownloadService,
            HelperHashVerifierService helperHashVerifierService,
            HelperReplacementService helperReplacementService
    ) {
        this.helperVersionChecker = helperVersionChecker;
        this.helperDownloadService = helperDownloadService;
        this.helperHashVerifierService = helperHashVerifierService;
        this.helperReplacementService = helperReplacementService;
    }

    @Async
    @PostConstruct
    public void runProbe() {
        log.info("[HelperVersionProbe] starting phase 3 probe");

        var update = helperVersionChecker.checkForUpdate();

        if (update.isPresent()) {
            log.info("[HelperVersionProbe] update available: {}", update.get().version());

            var downloaded = helperDownloadService.downloadHelper(update.get().downloadUrl(), update.get().sha256());
            if (downloaded.isPresent()) {
                boolean hashMatches = helperHashVerifierService.verifyDownloadedHelper(
                        downloaded.get(),
                        update.get().sha256()
                );

                if (hashMatches) {
                    log.info("[HelperVersionProbe] phase 4/5 completed successfully: download verified");
                    boolean replacementSucceeded = helperReplacementService.replaceAndRestart(downloaded.get());
                    if (replacementSucceeded) {
                        log.info("[HelperVersionProbe] phase 6 completed successfully: helper replaced and restarted");
                    } else {
                        log.info("[HelperVersionProbe] phase 6 failed: helper replacement/restart did not complete");
                    }
                } else {
                    log.info("[HelperVersionProbe] phase 4/5 completed with mismatch: download kept for inspection");
                }
            } else {
                log.info("[HelperVersionProbe] phase 4 failed: download did not complete");
            }
        } else {
            log.info("[HelperVersionProbe] no update available");
        }
    }
}
