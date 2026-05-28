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
////+++++[ ] B — Design the license system first so it's baked in from the start

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



Mise a jour yt-dlp: 

Va sur la page officielle des releases : yt-dlp GitHub Releases.

Cherche le fichier nommé yt-dlp.exe (pour Windows 64-bit).

Télécharge-le.

Va dans ton dossier : C:\Users\THINKPAD\OneDrop\OneDrop\tools\.

Supprime l'ancien yt-dlp.exe et colle le nouveau à la place.

Attention : Garde exactement le même nom de fichier pour que ton code Java/Node ne soit pas perdu.

2. Pourquoi ton projet "bloque" ?
Ton erreur montre que tu essaies d'extraire du WAV :
--extract-audio --audio-format wav

Pour que cette commande fonctionne, yt-dlp a besoin d'un autre outil invisible : FFmpeg.
Si après avoir mis à jour le .exe, ça ne marche toujours pas, vérifie que tu as bien un fichier ffmpeg.exe dans le même dossier tools ou dans ton "PATH" Windows. Sans lui, yt-dlp peut télécharger la vidéo, mais il ne pourra jamais transformer le son en .wav.

3. Astuce pour ne plus jamais oublier
Si tu veux que ton application mette à jour l'outil toute seule au démarrage (très pratique pour un projet de musique), tu peux ajouter cette ligne de commande dans ton code de lancement :

Bash
# Commande pour se mettre à jour tout seul
yt-dlp.exe -U
Est-ce que tu veux que je te donne la commande PowerShell pour télécharger la dernière version directement dans ton dossier tools sans passer par le navigateur?

# Generation setup.exe 
mettre l jar dans input a code de models et tools puis executer cette commande dans powershell
jpackage `
  --name OneDrop `
  --input input `
  --main-jar OneDrop.jar `
  --type app-image `
  --java-options "-Dloader.main=com.music.OneDrop.OneDropApplication"


après generation de oneDrop on ouvre innoSetup et on lance le script stocké dans release. 

voici le script
[Setup]
; Unique AppId (Generated for OneDrop). Keeps installations clean during updates.
AppId={{A3F9B2C4-1234-4567-89AB-CDEF12345678}
AppName=OneDrop
AppVersion=1.0.0
; CRITICAL: Forces installer to run with current user permissions (No UAC, correctly maps {localappdata})
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\OneDrop
DefaultGroupName=OneDrop
OutputDir=output
OutputBaseFilename=OneDropSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Files]
; Assumes the "OneDrop" folder generated by jpackage is in the same directory as this script
Source: "OneDrop\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\OneDrop"; Filename: "{app}\OneDrop.exe"
; Changed to {userdesktop} because non-admins can't write to {commondesktop}
Name: "{userdesktop}\OneDrop"; Filename: "{app}\OneDrop.exe"

[Run]
Filename: "{app}\OneDrop.exe"; Description: "Launch OneDrop"; Flags: nowait postinstall skipifsilent