# =======================================================================================
# ONEDROP FULL-STACK DEVELOPMENT AUTOMATION SCRIPT
# =======================================================================================
$ErrorActionPreference = "Stop"

# Define absolute paths based on the script's location
$ROOT_DIR = "C:\Users\THINKPAD\Projects\OneDrop"
$FRONTEND_DIR = Join-Path $ROOT_DIR "OneDropMusic"
$BACKEND_DIR = Join-Path $ROOT_DIR "OneDrop"
$BACKEND_STATIC_DIR = Join-Path $BACKEND_DIR "src\main\resources\static"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting OneDrop Build & Run Automation" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Build the React Frontend
Write-Host "`n📦 Step 1: Building React Frontend..." -ForegroundColor Yellow
Set-Location $FRONTEND_DIR
# Calling npm directly via cmd executor inside PowerShell avoids the Win32 binary issue
cmd /c "npm run build"

# 2. Clean up old backend static assets
Write-Host "`n🧹 Step 2: Cleaning old static assets in backend..." -ForegroundColor Yellow
if (Test-Path $BACKEND_STATIC_DIR) {
    Remove-Item -Path (Join-Path $BACKEND_STATIC_DIR "assets") -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $BACKEND_STATIC_DIR "index.html") -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Old assets and index.html erased." -ForegroundColor Green
} else {
    Write-Host "Creating missing static resources directory..." -ForegroundColor Gray
    New-Item -ItemType Directory -Path $BACKEND_STATIC_DIR -Force | Out-Null
}

# 3. Copy new frontend build to Spring Boot static folder
Write-Host "`n🚚 Step 3: Copying new production build to backend..." -ForegroundColor Yellow
$FRONTEND_DIST = Join-Path $FRONTEND_DIR "dist"

if (Test-Path $FRONTEND_DIST) {
    Copy-Item -Path "$FRONTEND_DIST\*" -Destination $BACKEND_STATIC_DIR -Recurse -Force
    Write-Host "✓ Frontend build successfully integrated into Spring Boot static resources." -ForegroundColor Green
} else {
    throw "Frontend build 'dist' folder not found. Check for React compilation errors."
}

# 4. Run Maven Clean Package
Write-Host "`n🔨 Step 4: Compiling backend and packaging JAR..." -ForegroundColor Yellow
Set-Location $BACKEND_DIR
cmd /c "mvn clean package -DskipTests"
Write-Host "✓ Backend compiled successfully." -ForegroundColor Green

# 5. Execute the compiled JAR application
Write-Host "`n🔥 Step 5: Launching OneDrop Backend Application..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------" -ForegroundColor Gray
$JAR_PATH = Join-Path $BACKEND_DIR "target\OneDrop-1.0.0.jar"

if (Test-Path $JAR_PATH) {
    java -jar $JAR_PATH
} else {
    throw "Target JAR file could not be found. Check Maven build logs."
}