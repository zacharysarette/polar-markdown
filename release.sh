#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Planning Central — macOS / Linux Release Script
# ============================================================================
#
# SAFETY: This script contains NO secrets or credentials. It relies on:
#   - npx tauri build   (local build)
#   - git                (commit + push)
#   - gh CLI             (create/upload GitHub Release — uses your logged-in session)
#
# PREREQUISITES:
#   - Node.js v20+, Rust (stable), Tauri CLI prerequisites for your OS
#   - GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
#   - macOS: Xcode Command Line Tools (`xcode-select --install`)
#   - Linux: webkit2gtk, libappindicator, librsvg, patchelf (see README)
#
# USAGE:
#   ./release.sh <version>       e.g.  ./release.sh 0.2.0
#
# MULTI-PLATFORM WORKFLOW (order doesn't matter):
#   Windows:  release.bat 0.2.0              — creates tag + release (or uploads)
#   macOS:    git pull && ./release.sh 0.2.0  — creates release or uploads artifacts
#   Linux:    git pull && ./release.sh 0.2.0  — creates release or uploads artifacts
#   Whichever platform runs first creates the release; the rest upload artifacts.
# ============================================================================

if [ $# -lt 1 ]; then
    echo "Usage: ./release.sh <version>"
    echo "Example: ./release.sh 0.2.0"
    exit 1
fi

VERSION="$1"
TAG="v${VERSION}"
BUNDLE_DIR="src-tauri/target/release/bundle"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

echo ""
echo "=== Planning Central Release ${TAG} (${OS} ${ARCH}) ==="
echo ""

# --- Step 1: Build ---
echo "[1/5] Building..."
npx tauri build

# --- Step 2: Locate artifacts ---
echo ""
echo "[2/5] Locating artifacts..."

ARTIFACTS=()

case "${OS}" in
    Darwin)
        # macOS: look for .dmg
        DMG=$(find "${BUNDLE_DIR}/dmg" -name "*.dmg" 2>/dev/null | head -1)
        if [ -z "${DMG}" ]; then
            echo "ERROR: No .dmg found in ${BUNDLE_DIR}/dmg/"
            exit 1
        fi
        echo "  Found: ${DMG}"

        # Label with architecture
        if [ "${ARCH}" = "arm64" ]; then
            ARTIFACTS+=("${DMG}#Planning Central (macOS Apple Silicon .dmg)")
        else
            ARTIFACTS+=("${DMG}#Planning Central (macOS Intel .dmg)")
        fi
        ;;
    Linux)
        # Linux: look for .deb and .AppImage
        DEB=$(find "${BUNDLE_DIR}/deb" -name "*.deb" 2>/dev/null | head -1)
        APPIMAGE=$(find "${BUNDLE_DIR}/appimage" -name "*.AppImage" 2>/dev/null | head -1)

        if [ -z "${DEB}" ] && [ -z "${APPIMAGE}" ]; then
            echo "ERROR: No .deb or .AppImage found in ${BUNDLE_DIR}/"
            exit 1
        fi

        if [ -n "${DEB}" ]; then
            echo "  Found: ${DEB}"
            ARTIFACTS+=("${DEB}#Planning Central (.deb)")
        fi
        if [ -n "${APPIMAGE}" ]; then
            echo "  Found: ${APPIMAGE}"
            ARTIFACTS+=("${APPIMAGE}#Planning Central (.AppImage)")
        fi
        ;;
    *)
        echo "ERROR: Unsupported OS '${OS}'. Use release.bat on Windows."
        exit 1
        ;;
esac

if [ ${#ARTIFACTS[@]} -eq 0 ]; then
    echo "ERROR: No artifacts found."
    exit 1
fi

# --- Step 3: Commit and push ---
echo ""
echo "[3/5] Committing and pushing..."
git add -A
git commit -m "Release ${TAG}" || echo "  (nothing to commit)"
git push origin master || git push origin main

# --- Step 4: Create or upload to release ---
echo ""
echo "[4/5] Checking for existing release..."

if gh release view "${TAG}" &>/dev/null; then
    echo "  Release ${TAG} already exists — uploading artifacts..."
    gh release upload "${TAG}" "${ARTIFACTS[@]}" --clobber
else
    echo "  Creating new release ${TAG}..."
    NOTES="Planning Central ${TAG}"
    case "${OS}" in
        Darwin) NOTES="${NOTES} — macOS ${ARCH} installer." ;;
        Linux)  NOTES="${NOTES} — Linux installers (.deb and/or .AppImage)." ;;
    esac

    gh release create "${TAG}" \
        "${ARTIFACTS[@]}" \
        --title "Planning Central ${TAG}" \
        --notes "${NOTES}"
fi

# --- Step 5: Done ---
echo ""
echo "[5/5] Done! Release published at:"
echo "  https://github.com/zacharysarette/planning-central/releases/tag/${TAG}"
echo ""
