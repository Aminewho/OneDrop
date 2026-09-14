# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OneDrop is a Windows desktop music tool that downloads YouTube audio, separates it into stems (vocals, drums, bass, other) using Spleeter, and detects BPM. It is packaged as an Electron app wrapping a Spring Boot backend.

## Architecture

```
OneDropDesktop/   — Electron shell (main.js launches Spring Boot, loads localhost:8081)
OneDropMusic/     — React/TypeScript frontend (Vite build, output copied to Spring Boot static/)
OneDrop/          — Spring Boot backend (Java, port 8081, serves frontend + REST API)
OneDrop/tools/    — External executables: spleeter.exe, ffmpeg.exe, ffprobe.exe, yt-helper.exe
```

### Key Services

- **Spring Boot** (port 8081): REST API + serves React static build. SQLite DB at `%LOCALAPPDATA%/OneDrop/database/onedrop.db`.
- **yt-helper** (port 8082): Python FastAPI server compiled to `yt-helper.exe` via PyInstaller. Handles YouTube search and audio download via yt-dlp. Source: `OneDrop/tools/server.py`.
- **Spleeter**: Python exe that splits a WAV into 4 stems (vocals, drums, bass, other). Run as a subprocess by `AudioProcessorService`.
- **Electron**: Launches `OneDrop.jar` using a bundled JRE at `app/runtime/bin/java.exe`, polls `localhost:8081` until ready, then shows the main window.

### yt-helper Lifecycle

`YoutubeService` (`@PostConstruct`) copies `yt-helper.exe` from the install `tools/` dir to `%LOCALAPPDATA%/OneDrop/tools/` on first run, then spawns it. The Helper auto-update system (files prefixed `Helper*`) checks GitHub Releases for a newer semver, downloads, verifies SHA-256, replaces the exe, and restarts the process — all in the background without blocking startup.

### File Paths at Runtime

| Purpose | Path |
|---|---|
| Install tools | `<jar_dir>/tools/` |
| User tools | `%LOCALAPPDATA%/OneDrop/tools/` |
| Pretrained models | `<jar_dir>/pretrained_models/` |
| Temp downloads | `%LOCALAPPDATA%/OneDrop/temp/` |
| Permanent tracks | `%LOCALAPPDATA%/OneDrop/tracks/<videoId>/` |
| Database | `%LOCALAPPDATA%/OneDrop/database/onedrop.db` |
| Config | `%LOCALAPPDATA%/OneDrop/config.json` |

### Frontend Pages

- `/` — Videos: YouTube search + download trigger
- `/separator` — Separator: stem separation playback (WaveformTrack)
- `/library` — Library: stored tracks
- `/spotify` — Spotify search

### Branding / Theming

On startup, `App.tsx` fetches `/api/config` to get `{ theme, logo, customer }`. `ConfigService` creates `config.json` on first launch with defaults. To add a theme: add it to `index.css`, register in `branding.ts`, place logo in `assets/logos/`.

## Development Commands

### Backend (Spring Boot)
```bash
cd OneDrop
mvn spring-boot:run
```

### Frontend (Vite dev server)
```bash
cd OneDropMusic
npm run dev
```

### yt-helper (Python FastAPI, dev mode)
```bash
# From repo root
. .venv/Scripts/Activate.ps1
python OneDrop/tools/server.py
```

### TypeScript type check
```bash
cd OneDropMusic
npm run check
```

## Production Build

```bash
# 1. Build React frontend
cd OneDropMusic && npm run build

# 2. Copy frontend output into Spring Boot static resources (PowerShell)
Remove-Item -Path OneDrop\src\main\resources\static -Recurse -Force
Copy-Item -Path OneDropMusic\dist\public\ -Destination OneDrop\src\main\resources\static -Recurse -Force

# 3. Build Spring Boot JAR
cd OneDrop && mvn clean package

# 4. Build Electron installer (place JAR in OneDropDesktop/app first)
cd OneDropDesktop && npm run dist
```

## Updating yt-helper

1. Bump `HELPER_VERSION` constant in `OneDrop/tools/server.py`.
2. Build the exe: `cd OneDrop/tools && pyinstaller --onefile --name yt-helper server.py`
3. Get the SHA-256 of the generated exe and update `version.json`.
4. Publish a new GitHub Release with both files (`yt-helper.exe` and `version.json`).

## Key Implementation Notes

- The frontend always calls `http://localhost:8081` (hardcoded in `Videos.tsx` and `App.tsx`). In Electron, this is the Spring Boot server. There is no separate Node dev-proxy used in production.
- `AudioProcessorService` resolves its install directory by inspecting the JAR's code source URL at class-load time (static initializer). It handles the `jar:nested:` URI scheme used by Spring Boot's executable JAR.
- Spleeter and BPM detection run in parallel via `CompletableFuture` during track processing.
- Search results are cached in-memory in `YoutubeService` for 120 seconds.
- The Electron `preload.js` clears relevant `localStorage`/`sessionStorage` keys on each launch to reset UI state.
- `SpaFilter` in Spring Boot ensures all unknown routes return `index.html` for client-side routing.
