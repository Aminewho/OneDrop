const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
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

    mainWindow.on("closed", () => {

        if (javaProcess) {
            javaProcess.kill();
        }

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

    if (javaProcess) {
        javaProcess.kill();
    }

    if (process.platform !== "darwin") {
        app.quit();
    }

});

app.on("before-quit", () => {

    if (javaProcess) {
        javaProcess.kill();
    }

});