const { app, BrowserWindow, dialog } = require("electron");
const { spawn, execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
}

let splashWindow;
let mainWindow;
let javaProcess;
let springStarted = false;

const LOCALAPPDATA_DIR = path.join(process.env.LOCALAPPDATA || path.join(require("os").homedir(), "AppData", "Local"), "OneDrop");
const SHUTDOWN_LOG_FILE = path.join(LOCALAPPDATA_DIR, "electron-shutdown.log");

function logShutdown(message) {

    const line = `[${new Date().toISOString()}] ${message}`;

    console.log(line);

    try {
        fs.mkdirSync(LOCALAPPDATA_DIR, { recursive: true });
        fs.appendFileSync(SHUTDOWN_LOG_FILE, line + "\n");
    } catch (err) {
        console.error("Failed to write shutdown log:", err);
    }

}

// En développement : ../app
// Après installation : resources/app
const APP_DIR = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..", "app");

const ICON = path.join(__dirname, "..", "assets", "icon.ico");

function checkInstallation() {

    const required = [
        path.join(APP_DIR, "OneDrop.jar"),
        path.join(APP_DIR, "runtime", "bin", "java.exe"),
        path.join(APP_DIR, "tools"),
        path.join(APP_DIR, "pretrained_models")
    ];

    for (const file of required) {

        if (!fs.existsSync(file)) {

            dialog.showErrorBox(
                "Installation Error",
                `Missing resource:\n\n${file}\n\nPlease reinstall OneDrop.`
            );

            app.quit();

            return false;
        }
    }

    return true;
}

function createSplash() {

    splashWindow = new BrowserWindow({

        width: 500,
        height: 300,

        frame: false,

        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,

        alwaysOnTop: true,

        backgroundColor: "#181818",

        icon: ICON,

        webPreferences: {

            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true

        }

    });

    splashWindow.loadFile(path.join(__dirname, "splash.html"));

}

function startSpring() {

    const javaExe = path.join(APP_DIR, "runtime", "bin", "java.exe");

    console.log("========================================");
    console.log("APP_DIR :", APP_DIR);
    console.log("JAVA    :", javaExe);
    console.log("========================================");

    javaProcess = spawn(
        javaExe,
        [
            "-Dloader.main=com.music.OneDrop.OneDropApplication",
            "-jar",
            "OneDrop.jar"
        ],
        {
            cwd: APP_DIR,
            windowsHide: true
        }
    );

    javaProcess.stdout.on("data", data => {
        console.log(data.toString());
    });

    javaProcess.stderr.on("data", data => {
        console.error(data.toString());
    });

    javaProcess.on("error", err => {

        console.error(err);

        dialog.showErrorBox(
            "Startup Error",
            "Unable to start Java Runtime."
        );

        app.quit();

    });

    javaProcess.on("close", code => {

        console.log("Java exited :", code);

        if (!springStarted) {

            dialog.showErrorBox(
                "Startup Error",
                "Spring Boot failed to start."
            );

            app.quit();

        }

    });

}

function killHelperProcess() {

    // javaProcess.kill() is a hard TerminateProcess() on Windows, so the JVM
    // never runs its shutdown hooks and yt-helper.exe (its child process) is
    // orphaned. Kill it directly by name to guarantee cleanup.
    //
    // This returns a Promise that only resolves once taskkill has actually
    // finished (or a timeout fires) — app.quit()/app.exit() tear down the
    // process (and any Job Object its children belong to) almost immediately
    // after the synchronous handler returns, which was killing the spawned
    // taskkill.exe mid-flight before its callback ever ran.
    return new Promise((resolve) => {

        let settled = false;
        const finish = () => {
            if (!settled) {
                settled = true;
                resolve();
            }
        };

        const timeoutId = setTimeout(() => {
            logShutdown("taskkill timed out after 5s, continuing shutdown anyway");
            finish();
        }, 5000);

        execFile("taskkill", ["/F", "/IM", "yt-helper.exe"], (error, stdout, stderr) => {

            clearTimeout(timeoutId);

            if (error) {
                logShutdown(`taskkill error: ${error.message}`);
            }
            if (stdout && stdout.trim()) {
                logShutdown(`taskkill stdout: ${stdout.trim()}`);
            }
            if (stderr && stderr.trim()) {
                logShutdown(`taskkill stderr: ${stderr.trim()}`);
            }

            finish();

        });

    });

}

async function performShutdown() {

    logShutdown("performShutdown() starting");

    if (javaProcess) {
        logShutdown("killing javaProcess");
        javaProcess.kill();
        javaProcess = null;
    } else {
        logShutdown("javaProcess already null, skipping");
    }

    await killHelperProcess();

    logShutdown("performShutdown() complete");

}

function waitForSpring() {

    console.log("Waiting for Spring Boot...");

    const timer = setInterval(() => {

        http.get("http://localhost:8081", () => {

            clearInterval(timer);

            springStarted = true;

            createMainWindow();

        }).on("error", () => {

            // Spring n'est pas encore prêt

        });

    }, 1000);

}

function createMainWindow() {

    mainWindow = new BrowserWindow({

        width: 1400,
        height: 900,

        minWidth: 1200,
        minHeight: 800,

        show: false,

        autoHideMenuBar: true,

        title: "OneDrop",

        backgroundColor: "#181818",

        icon: ICON,

        webPreferences: {

            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true

        }

    });

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.loadURL("http://localhost:8081");

    mainWindow.once("ready-to-show", () => {

        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }

        mainWindow.show();

    });

}

app.whenReady().then(() => {

    if (!checkInstallation()) {
        return;
    }

    createSplash();

    startSpring();

    waitForSpring();

});

app.on("window-all-closed", () => {

    if (process.platform !== "darwin") {
        app.quit();
    }

});

let isShuttingDown = false;

app.on("before-quit", event => {

    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    event.preventDefault();

    performShutdown()
        .catch(err => logShutdown(`performShutdown error: ${err.message}`))
        .finally(() => app.exit(0));

});