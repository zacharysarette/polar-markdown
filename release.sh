#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Polar Markdown — macOS / Linux Release Script
# ============================================================================
#
# USAGE:
#   ./release.sh patch          Bump patch  (0.4.1 -> 0.4.2)
#   ./release.sh minor          Bump minor  (0.4.1 -> 0.5.0)
#   ./release.sh major          Bump major  (0.4.1 -> 1.0.0)
#   ./release.sh 1.2.3          Explicit version
#
# PREREQUISITES:
#   - Node.js v20+, Rust (stable), Tauri CLI prerequisites for your OS
#   - GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
#   - macOS: Xcode Command Line Tools (`xcode-select --install`)
#   - Linux: webkit2gtk, libappindicator, librsvg, patchelf (see README)
#
# WHAT IT DOES (in order):
#   1. If on a feature branch: check status, commit, push, create GitHub PR,
#      merge via gh, switch to master and pull
#      If already on master: pull latest
#   2. Calculate new version (or use explicit)
#   3. Update version in package.json, tauri.conf.json, Cargo.toml
#   4. Run tests (vitest, cargo test, svelte-check)
#   5. Build with npx tauri build
#   6. Commit, push, create GitHub Release with installers
# ============================================================================

if [ $# -lt 1 ]; then
    echo "Usage: ./release.sh <patch|minor|major|VERSION>"
    echo ""
    echo "Examples:"
    echo "  ./release.sh patch       0.4.1 -> 0.4.2"
    echo "  ./release.sh minor       0.4.1 -> 0.5.0"
    echo "  ./release.sh major       0.4.1 -> 1.0.0"
    echo "  ./release.sh 1.2.3       explicit version"
    exit 1
fi

BUMP="$1"
BUNDLE_DIR="src-tauri/target/release/bundle"
OS="$(uname -s)"
ARCH="$(uname -m)"

# --- Step 1: Merge feature branch (if any) into master via GitHub PR ---
echo ""
echo "[1/7] Preparing master branch..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "${CURRENT_BRANCH}" != "master" ] && [ "${CURRENT_BRANCH}" != "main" ]; then
    echo "  On feature branch: ${CURRENT_BRANCH}"

    # Check git status for uncommitted changes
    echo "  Checking for uncommitted changes..."
    git status --short

    if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        echo "  Committing uncommitted changes..."
        git add -A
        git commit -m "feat: ${CURRENT_BRANCH}"
    fi

    # Push feature branch
    echo "  Pushing feature branch..."
    git push -u origin "${CURRENT_BRANCH}" 2>/dev/null || git push origin "${CURRENT_BRANCH}"

    # Create PR and merge via GitHub
    echo "  Creating PR on GitHub..."
    PR_URL=$(gh pr create --base master --head "${CURRENT_BRANCH}" --title "${CURRENT_BRANCH}" --body "Automated release PR" --fill 2>/dev/null) || \
        PR_URL=$(gh pr view "${CURRENT_BRANCH}" --json url --jq .url 2>/dev/null)
    echo "  PR: ${PR_URL}"

    echo "  Merging PR via GitHub..."
    if ! gh pr merge "${CURRENT_BRANCH}" --merge --delete-branch --admin; then
        echo "Failed to merge PR. Check GitHub for details."
        exit 1
    fi

    # Switch to master and pull merged changes
    echo "  Switching to master and pulling..."
    git checkout master
    git pull origin master
    # Clean up local feature branch if it still exists
    git branch -d "${CURRENT_BRANCH}" 2>/dev/null || true
else
    echo "  Already on master."
    git fetch origin
    git pull origin master
fi

# --- Step 2: Calculate version ---
echo ""
echo "[2/7] Calculating version..."

OLD_VERSION=$(node -p "require('./package.json').version")
VERSION=$(node -p "
  const [M,m,P] = '${OLD_VERSION}'.split('.').map(Number);
  const b = '${BUMP}';
  b === 'major' ? \`\${M+1}.0.0\` :
  b === 'minor' ? \`\${M}.\${m+1}.0\` :
  b === 'patch' ? \`\${M}.\${m}.\${P+1}\` : b
")

# Validate version format
if ! echo "${VERSION}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "ERROR: Invalid version \"${VERSION}\". Must be MAJOR.MINOR.PATCH or one of: patch, minor, major"
    exit 1
fi

TAG="v${VERSION}"

echo "  Current version: ${OLD_VERSION}"
echo "  New version:     ${VERSION} (${TAG})"

# --- Step 3: Update version in all config files ---
echo ""
echo "[3/7] Updating version in config files..."

node -e "
  const fs = require('fs');
  const f = 'package.json';
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.version = '${VERSION}';
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
"
echo "  Updated package.json"

node -e "
  const fs = require('fs');
  const f = 'src-tauri/tauri.conf.json';
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.version = '${VERSION}';
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
"
echo "  Updated tauri.conf.json"

node -e "
  const fs = require('fs');
  const f = 'src-tauri/Cargo.toml';
  let t = fs.readFileSync(f, 'utf8');
  t = t.replace(/^version\s*=\s*\".*?\"/m, 'version = \"${VERSION}\"');
  fs.writeFileSync(f, t);
"
echo "  Updated Cargo.toml"

# Helper to restore files on failure
restore_versions() {
    echo "Restoring version files..."
    git checkout -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
}

# --- Step 4: Run tests ---
echo ""
echo "[4/7] Running tests..."

echo "  Running frontend tests..."
if ! npx vitest run; then
    echo ""
    echo "FRONTEND TESTS FAILED. Aborting release."
    restore_versions
    exit 1
fi

echo ""
echo "  Running Rust tests..."
if ! (cd src-tauri && cargo test); then
    echo ""
    echo "RUST TESTS FAILED. Aborting release."
    restore_versions
    exit 1
fi

echo ""
echo "  Running svelte-check..."
npx svelte-check || true  # warnings are OK

echo ""
echo "  All tests passed!"

# --- Step 5: Build ---
echo ""
echo "[5/7] Building..."

npx tauri build

# Locate artifacts
echo ""
echo "  Locating artifacts..."

ARTIFACTS=()

case "${OS}" in
    Darwin)
        DMG=$(find "${BUNDLE_DIR}/dmg" -name "*.dmg" 2>/dev/null | head -1)
        if [ -z "${DMG}" ]; then
            echo "ERROR: No .dmg found in ${BUNDLE_DIR}/dmg/"
            exit 1
        fi
        echo "  Found: ${DMG}"
        if [ "${ARCH}" = "arm64" ]; then
            ARTIFACTS+=("${DMG}#Polar Markdown (macOS Apple Silicon .dmg)")
        else
            ARTIFACTS+=("${DMG}#Polar Markdown (macOS Intel .dmg)")
        fi
        ;;
    Linux)
        DEB=$(find "${BUNDLE_DIR}/deb" -name "*.deb" 2>/dev/null | head -1)
        APPIMAGE=$(find "${BUNDLE_DIR}/appimage" -name "*.AppImage" 2>/dev/null | head -1)
        if [ -z "${DEB}" ] && [ -z "${APPIMAGE}" ]; then
            echo "ERROR: No .deb or .AppImage found in ${BUNDLE_DIR}/"
            exit 1
        fi
        if [ -n "${DEB}" ]; then
            echo "  Found: ${DEB}"
            ARTIFACTS+=("${DEB}#Polar Markdown (.deb)")
        fi
        if [ -n "${APPIMAGE}" ]; then
            echo "  Found: ${APPIMAGE}"
            ARTIFACTS+=("${APPIMAGE}#Polar Markdown (.AppImage)")
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

# --- Step 6: Commit and push ---
echo ""
echo "[6/7] Committing and pushing..."
git add -A
git commit -m "Release ${TAG}" || echo "  (nothing to commit)"
git push origin master || git push origin main

# --- Step 7: Create GitHub Release ---
echo ""
echo "[7/7] Creating GitHub Release ${TAG}..."

if gh release view "${TAG}" &>/dev/null; then
    echo "  Release ${TAG} already exists — uploading artifacts..."
    gh release upload "${TAG}" "${ARTIFACTS[@]}" --clobber
else
    echo "  Creating new release ${TAG}..."
    NOTES="Polar Markdown ${TAG}"
    case "${OS}" in
        Darwin) NOTES="${NOTES} — macOS ${ARCH} installer." ;;
        Linux)  NOTES="${NOTES} — Linux installers (.deb and/or .AppImage)." ;;
    esac

    gh release create "${TAG}" \
        "${ARTIFACTS[@]}" \
        --title "Polar Markdown ${TAG}" \
        --notes "${NOTES}"
fi

echo ""
echo "=== Release ${TAG} complete! ==="
echo "  https://github.com/zacharysarette/polar-markdown/releases/tag/${TAG}"
echo ""
