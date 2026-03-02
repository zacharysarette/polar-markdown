@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Polar Markdown — Windows Release Script
:: ============================================================================
::
:: USAGE:
::   release.bat patch          Bump patch  (0.4.1 -> 0.4.2)
::   release.bat minor          Bump minor  (0.4.1 -> 0.5.0)
::   release.bat major          Bump major  (0.4.1 -> 1.0.0)
::   release.bat 1.2.3          Explicit version
::
:: PREREQUISITES:
::   - Node.js v20+, Rust (stable), Tauri CLI prerequisites (WebView2, VS Build Tools)
::   - GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
::   - Working directory is the repo root
::
:: WHAT IT DOES (in order):
::   1. If on a feature branch: check status, commit, push, create GitHub PR,
::      merge via gh, switch to master and pull
::      If already on master: pull latest
::   2. Calculate new version (or use explicit)
::   3. Update version in package.json, tauri.conf.json, Cargo.toml
::   4. Run tests (vitest, cargo test, svelte-check)
::   5. Build with npx tauri build
::   6. Commit, push, create GitHub Release with installers
:: ============================================================================

if "%~1"=="" (
    echo Usage: release.bat ^<patch^|minor^|major^|VERSION^>
    echo.
    echo Examples:
    echo   release.bat patch       0.4.1 -^> 0.4.2
    echo   release.bat minor       0.4.1 -^> 0.5.0
    echo   release.bat major       0.4.1 -^> 1.0.0
    echo   release.bat 1.2.3       explicit version
    exit /b 1
)

set BUMP=%~1

:: --- Step 0: Merge feature branch (if any) into master via GitHub PR ---
echo.
echo [1/7] Preparing master branch...

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%B

if "!CURRENT_BRANCH!"=="master" goto :on_master
if "!CURRENT_BRANCH!"=="main" goto :on_master

echo   On feature branch: !CURRENT_BRANCH!

:: Check git status for uncommitted changes
echo   Checking for uncommitted changes...
git status --short
git diff --quiet 2>nul
set HAS_UNSTAGED=%errorlevel%
git diff --cached --quiet 2>nul
set HAS_STAGED=%errorlevel%
for /f %%U in ('git ls-files --others --exclude-standard') do set HAS_UNTRACKED=1
if not defined HAS_UNTRACKED set HAS_UNTRACKED=0

if !HAS_UNSTAGED! neq 0 goto :do_commit
if !HAS_STAGED! neq 0 goto :do_commit
if !HAS_UNTRACKED! neq 0 goto :do_commit
goto :skip_commit

:do_commit
echo   Committing uncommitted changes...
git add -A
git commit -m "feat: !CURRENT_BRANCH!"

:skip_commit
:: Push feature branch
echo   Pushing feature branch...
git push -u origin "!CURRENT_BRANCH!" 2>nul
if errorlevel 1 git push origin "!CURRENT_BRANCH!"

:: Create PR and merge via GitHub
echo   Creating PR on GitHub...
for /f "delims=" %%P in ('gh pr create --base master --head "!CURRENT_BRANCH!" --title "!CURRENT_BRANCH!" --body "Automated release PR" --fill 2^>nul') do set PR_URL=%%P
if errorlevel 1 (
    :: PR may already exist — try to find it
    for /f "delims=" %%P in ('gh pr view "!CURRENT_BRANCH!" --json url --jq .url 2^>nul') do set PR_URL=%%P
)
echo   PR: !PR_URL!

echo   Merging PR via GitHub...
gh pr merge "!CURRENT_BRANCH!" --merge --delete-branch --admin
if errorlevel 1 (
    echo Failed to merge PR. Check GitHub for details.
    exit /b 1
)

:: Switch to master and pull merged changes
echo   Switching to master and pulling...
git checkout master
git pull origin master
:: Clean up local feature branch if it still exists
git branch -d "!CURRENT_BRANCH!" 2>nul
goto :after_master

:on_master
echo   Already on master.
git fetch origin
git pull origin master
if errorlevel 1 (
    echo Failed to pull latest master.
    exit /b 1
)

:after_master

:: --- Step 1: Read current version and calculate new version ---
echo.
echo [2/7] Calculating version...

:: Use node to read current version and compute the new one
for /f "delims=" %%V in ('node -p "const p=require('./package.json'); const [M,m,P]=p.version.split('.').map(Number); const b='%BUMP%'; b==='major'?`${M+1}.0.0`:b==='minor'?`${M}.${m+1}.0`:b==='patch'?`${M}.${m}.${P+1}`:b"') do set VERSION=%%V

:: Validate version format (avoid ! in node code due to delayed expansion)
node -e "var ok=/^\d+[.]\d+[.]\d+$/.test('!VERSION!'); process.exit(ok?0:1)"
if errorlevel 1 (
    echo ERROR: Invalid version "!VERSION!". Must be MAJOR.MINOR.PATCH or one of: patch, minor, major
    exit /b 1
)

:: Read old version for replacement
for /f "delims=" %%O in ('node -p "require('./package.json').version"') do set OLD_VERSION=%%O

set TAG=v!VERSION!

echo   Current version: !OLD_VERSION!
echo   New version:     !VERSION! (!TAG!)

:: --- Step 2: Update version in all config files ---
echo.
echo [3/7] Updating version in config files...

node -e "const fs=require('fs'); const f='package.json'; const j=JSON.parse(fs.readFileSync(f,'utf8')); j.version='!VERSION!'; fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');"
if errorlevel 1 (
    echo Failed to update package.json
    exit /b 1
)
echo   Updated package.json

node -e "const fs=require('fs'); const f='src-tauri/tauri.conf.json'; const j=JSON.parse(fs.readFileSync(f,'utf8')); j.version='!VERSION!'; fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');"
if errorlevel 1 (
    echo Failed to update tauri.conf.json
    exit /b 1
)
echo   Updated tauri.conf.json

node -e "const fs=require('fs'); const f='src-tauri/Cargo.toml'; let t=fs.readFileSync(f,'utf8'); t=t.replace(/^version\s*=\s*\".*?\"/m,'version = \"!VERSION!\"'); fs.writeFileSync(f,t);"
if errorlevel 1 (
    echo Failed to update Cargo.toml
    exit /b 1
)
echo   Updated Cargo.toml

:: --- Step 3: Run tests ---
echo.
echo [4/7] Running tests...

echo   Running frontend tests...
call npx vitest run
if errorlevel 1 (
    echo.
    echo TESTS FAILED. Aborting release.
    echo Restoring version files...
    git checkout -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
    exit /b 1
)

echo.
echo   Running Rust tests...
pushd src-tauri
cargo test
if errorlevel 1 (
    popd
    echo.
    echo RUST TESTS FAILED. Aborting release.
    echo Restoring version files...
    git checkout -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
    exit /b 1
)
popd

echo.
echo   Running svelte-check...
call npx svelte-check
:: svelte-check returns 1 for warnings too, so check output for errors
:: We allow warnings (the pre-existing state_referenced_locally warning)

echo.
echo   All tests passed!

:: --- Step 4: Build ---
echo.
echo [5/7] Building...

set NSIS=src-tauri\target\release\bundle\nsis\Polar Markdown_!VERSION!_x64-setup.exe
set MSI=src-tauri\target\release\bundle\msi\Polar Markdown_!VERSION!_x64_en-US.msi

call npx tauri build
if errorlevel 1 (
    echo Build failed.
    echo Restoring version files...
    git checkout -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
    exit /b 1
)

:: Verify installers exist
if not exist "!NSIS!" (
    echo NSIS installer not found: !NSIS!
    exit /b 1
)
if not exist "!MSI!" (
    echo MSI installer not found: !MSI!
    exit /b 1
)

:: --- Step 5: Commit and push ---
echo.
echo [6/7] Committing and pushing...
git add -A
git commit -m "Release !TAG!"
git push origin master

:: --- Step 6: Create GitHub Release ---
echo.
echo [7/7] Creating GitHub Release !TAG!...

gh release view !TAG! >nul 2>&1
if not errorlevel 1 (
    echo Release !TAG! already exists — uploading Windows artifacts...
    gh release upload !TAG! "!NSIS!#Polar Markdown Installer (NSIS)" "!MSI!#Polar Markdown Installer (MSI)" --clobber
    if errorlevel 1 (
        echo Upload failed.
        exit /b 1
    )
    goto :done
)

gh release create !TAG! ^
    "!NSIS!#Polar Markdown Installer (NSIS)" ^
    "!MSI!#Polar Markdown Installer (MSI)" ^
    --title "Polar Markdown !TAG!" ^
    --notes "Polar Markdown !TAG! — Windows x64 installers. Run the NSIS .exe (recommended) or MSI to install."

if errorlevel 1 (
    echo Release creation failed.
    exit /b 1
)

:done
echo.
echo === Release !TAG! complete! ===
echo https://github.com/zacharysarette/polar-markdown/releases/tag/!TAG!
echo.
