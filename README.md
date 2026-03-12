npx cross-env NODE_ENV=development npx tsx server/index.ts
mvn spring-boot:run

prod : 
npm run build 
=> copy /dist/public to /static
mvn clean package
java -jar C:\Users\THINKPAD\OneDrop\OneDrop\target\OneDrop-0.0.1-SNAPSHOT.jar














Phase 1 — Prepare your assets
Step 1: Build the React frontend
Run npm run build → this generates a static ui/ folder. Your Spring Boot backend will serve these files directly, so you don't need a separate Node server.
Step 2: Configure Spring Boot to serve the React build
Copy the React build/ output into src/main/resources/static/ before building your JAR, so the backend serves the frontend at localhost:8081.
Step 3: Package the backend JAR
Run mvn package or ./gradlew bootJar → produces backend.jar. Test it standalone: java -jar backend.jar.

Phase 2 — Tools download logic (Spring Boot)
Step 4: Add tools check on startup
In your Spring Boot app, add a @Component with @PostConstruct that:

Checks if %APPDATA%/OneDrop/tools/ exists
Checks if each tool (spleeter.exe, yt-dlp.exe, ffmpeg.exe, ffprobe.exe) is present
If missing → downloads and extracts tools.zip

Step 5: Host your tools.zip
Upload the zip to Cloudflare R2 (cheapest), GitHub Releases (free for public), or any CDN. Get a direct download URL.
Step 6: Add a progress endpoint
Expose a /api/setup/status endpoint so the frontend can show a download progress bar on first launch instead of a blank screen.

Phase 3 — The Launcher
Step 7: Write launcher.py
pythonimport subprocess, webbrowser, time, sys, os

app_dir = os.path.dirname(sys.executable)
backend = os.path.join(app_dir, "backend.jar")

proc = subprocess.Popen(["java", "-jar", backend])
time.sleep(4)
webbrowser.open("http://localhost:8081")
proc.wait()
Step 8: Convert to launcher.exe
bashpip install pyinstaller
pyinstaller --onefile --windowed --icon=icon.ico launcher.py
```
The `--windowed` flag hides the terminal window.

---

## Phase 4 — The Installer

**Step 9: Write the Inno Setup script**
This is where it all comes together — it bundles `launcher.exe` + `backend.jar` + `ui/` into a single `OneDrop-Setup.exe`.

**Step 10: Test the full install flow**
Install on a clean Windows machine (or VM), verify:
- Tools download correctly on first launch
- App opens in browser automatically
- Uninstaller works cleanly

---

## Your build order checklist
```
[ ] 1. npm run build  →  ui/
[ ] 2. Copy ui/ into Spring Boot static resources
[ ] 3. mvn package   →  backend.jar
[ ] 4. Add tools-check logic to Spring Boot startup
[ ] 5. Upload tools.zip to CDN, paste URL in backend
[ ] 6. Write + test launcher.py
[ ] 7. PyInstaller → launcher.exe
[ ] 8. Inno Setup script → OneDrop-Setup.exe
[ ] 9. Test on clean VM