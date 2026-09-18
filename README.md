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







compress Your Executables with UPX (Saves 40% across all tools)

Dynamic coloring : Plus tard je  n'aurais qu'à remplacer les valeurs statiques par les valeurs renvoyées par ton serveur distant et réécrire ce même config.json dans le fichier ConfigService.java Le frontend n'aura aucun changement à faire.
Pour ajouter un theme : il faut ajouter un theme dans index.css et ajouter un le theme dans branding.ts et le logos dans le dossier logos puis le fichier config.json servira le vrai theme. 



Je développe une application Windows appelée OneDrop.

Architecture :
- Electron comme desktop shell
- React frontend
- Spring Boot / Java backend
- Python FastAPI helper compilé avec PyInstaller
- yt-helper.exe écoute sur 127.0.0.1:8082
- YoutubeService démarre et arrête actuellement yt-helper.exe
- AudioProcessorService utilise le helper pour télécharger les vidéos/audio YouTube.

Je veux implémenter un système d'auto-update UNIQUEMENT pour yt-helper.exe.

Repository GitHub :
https://github.com/Aminewho/OneDrop

Une première GitHub Release existe :
yt-helper-v1.0.0

Elle contient :
- yt-helper.exe
- version.json



Le helper doit être utilisé depuis :
%LOCALAPPDATA%\OneDrop\tools\yt-helper.exe

La copie présente dans l'installation de OneDrop sert uniquement de copie initiale/fallback.

Je veux ce workflow :

1. yt-helper.py possède une constante HELPER_VERSION = "1.0.0".
2. Ajouter GET /version retournant :
   {"version":"1.0.0"}
3. Java peut récupérer la version locale via /version.
4. Java récupère le manifest version.json depuis GitHub.
5. Comparer correctement les versions semver.
6. Si une nouvelle version existe, télécharger yt-helper.exe vers yt-helper.exe.download.
7. Calculer le SHA-256 du fichier téléchargé.
8. Comparer avec le SHA-256 présent dans version.json.
9. Si le hash est incorrect, supprimer le téléchargement et conserver l'ancien helper.
10. Si le hash est correct, arrêter proprement le helper.
11. Remplacer yt-helper.exe par la nouvelle version.
12. Redémarrer le helper.
13. Vérifier /health puis /version.
14. En cas d'échec du remplacement ou du démarrage, prévoir un fallback vers l'ancien helper.
15. Une absence d'Internet ou une erreur GitHub ne doit jamais empêcher OneDrop de démarrer.
16. La vérification doit être exécutée en arrière-plan et ne doit pas bloquer le démarrage de l'application.

Je veux implémenter cela progressivement.

Commence par analyser mon YoutubeService actuel et mon yt-helper.py actuel avant de proposer du code.
L'auto-update je la veux dans un fichier tout seul ne la met pas dans le fichier youtubeService
Ne modifie pas encore AudioProcessorService sauf si cela est nécessaire pour que le changement de chemin vers %LOCALAPPDATA%\OneDrop\tools\yt-helper.exe soit cohérent.

Ne mélange pas ce système avec electron-updater : l'auto-update de yt-helper est un système indépendant de l'auto-update future de OneDrop.

Procède phase par phase :
Phase 1 : /version et version locale
Phase 2 : récupération de version.json
Phase 3 : comparaison des versions
Phase 4 : téléchargement
Phase 5 : SHA-256
Phase 6 : arrêt/remplacement/redémarrage
Phase 7 : orchestration complète
Phase 8 : intégration React

À chaque phase :
- explique ce qu'on fait ;
- donne le code exact à modifier ;
- indique dans quel fichier ;
- explique comment tester ;
- n'implémente pas la phase suivante avant validation de la phase actuelle.



























git fetch origin 
git reset --hard origin/stable-version


Remove-Item -Path C:\Users\THINKPAD\Projects\OneDrop\OneDrop\src\main\resources\static -Recurse -Force 
Copy-Item -Path C:\Users\THINKPAD\Projects\OneDrop\OneDropMusic\dist\public\ -Destination C:\Users\THINKPAD\Projects\OneDrop\OneDrop\src\main\resources\static -Recurse -Force




Remove-Item -Path C:\Users\a.ziadi\PROJECTS\OneDrop\OneDrop\src\main\resources\static -Recurse -Force 
Copy-Item -Path C:\Users\a.ziadi\PROJECTS\OneDrop\OneDropMusic\dist\public\ -Destination C:\Users\a.ziadi\PROJECTS\OneDrop\OneDrop\src\main\resources\static -Recurse -Force
Pour generer le setup on met le jar dans app puis  on va dand onedrop deskotop et on execute : npm run dist
 
 yt-dlp in dev mode 
  -C:\Users\THINKPAD\Projects\OneDrop> . .\.venv\Scripts\Activate.ps1
  -python OneDrop\tools\server.py

yt-dlp in exe :
pyinstaller --onefile --name yt-helper server.py : this will genrate the exe 
to update the helper:
1- we change the version in the server.py file and then => 2-C:\Users\THINKPAD\Projects\OneDrop\OneDrop\tools> pyinstaller --onefile --name yt-helper server.py
3- we get sha256 of the generated exe and then we update the version.json file 
4- we publish a new release uploading the two files(exe and json)



To Do : 
- explore the yt-dlp search 
- navbar
- yt-helper update and ending process

