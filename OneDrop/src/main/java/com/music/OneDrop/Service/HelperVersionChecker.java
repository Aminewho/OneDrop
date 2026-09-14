package com.music.OneDrop.Service;

import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class HelperVersionChecker {

    private final HelperVersionClient helperVersionClient;
    private final HelperReleaseManifestClient helperReleaseManifestClient;
    private final HelperVersionComparator helperVersionComparator;

    public HelperVersionChecker(
            HelperVersionClient helperVersionClient,
            HelperReleaseManifestClient helperReleaseManifestClient,
            HelperVersionComparator helperVersionComparator
    ) {
        this.helperVersionClient = helperVersionClient;
        this.helperReleaseManifestClient = helperReleaseManifestClient;
        this.helperVersionComparator = helperVersionComparator;
    }

    public Optional<HelperReleaseManifestClient.HelperManifest> checkForUpdate() {
        String localVersion = helperVersionClient.getLocalVersion().orElse(null);
        Optional<HelperReleaseManifestClient.HelperManifest> remoteManifest =
                helperReleaseManifestClient.fetchRemoteManifest();

        if (localVersion == null || remoteManifest.isEmpty()) {
            System.out.println("[HelperVersionChecker] cannot compare versions: local=" + localVersion + ", remoteAvailable=" + remoteManifest.isPresent());
            return Optional.empty();
        }

        HelperReleaseManifestClient.HelperManifest remote = remoteManifest.get();

        System.out.println("[HelperVersionChecker] comparing local version " + localVersion + " against remote version " + remote.version());

        if (helperVersionComparator.isRemoteVersionNewer(localVersion, remote.version())) {
            System.out.println("[HelperVersionChecker] update available: local=" + localVersion + ", remote=" + remote.version());
            return remoteManifest;
        }

        System.out.println("[HelperVersionChecker] no update required: local=" + localVersion + ", remote=" + remote.version());
        return Optional.empty();
    }
}
