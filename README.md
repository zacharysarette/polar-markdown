<p align="center">
  <img src="img/logo.png" alt="Glacimark" width="220">
</p>

<h1 align="center">Glacimark</h1>

<p align="center">
  <strong>A blazing-fast desktop markdown editor and viewer with live preview and diagram support</strong><br>
  Built with <b>Tauri 2</b> + <b>Svelte 5</b> + <b>TypeScript</b> &mdash; ~5 MB app, ~40 MB RAM
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/features-packed-blue?style=for-the-badge" alt="Features"></a>
  <a href="#getting-started"><img src="https://img.shields.io/badge/setup-easy-green?style=for-the-badge" alt="Setup"></a>
  <a href="https://github.com/zacharysarette/glacimark/releases"><img src="https://img.shields.io/badge/download-latest-orange?style=for-the-badge" alt="Download"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-purple?style=for-the-badge" alt="License"></a>
</p>

<p align="center">
  <em>Write, edit, and view markdown with live-rendered Mermaid diagrams, split-pane editing, full-text search, and instant file watching — all in a native app that starts in under a second.</em>
</p>

---

## Features

| | Feature | Description |
|---|---|---|
| **Editor** | Split-pane | CodeMirror 6 editor with live preview side-by-side |
| **Editor** | Auto-save | Saves automatically after 1s, or immediately with Ctrl+S |
| **Editor** | Scroll sync | Editor and preview scroll together proportionally |
| **Editor** | Active line | Cursor position highlights the matching element in the preview |
| **Rendering** | Markdown | Syntax-highlighted code blocks, tables, and full formatting |
| **Diagrams** | Mermaid | Live SVG flowcharts, sequence diagrams, ER diagrams, and more |
| **Diagrams** | ASCII Art | svgbob renders box-drawing characters and `bob`/`svgbob` code blocks |
| **Search** | Full-text | Search across all markdown files with line-number results |
| **Layout** | Multi-pane | Open up to 4 files side-by-side (Ctrl+Click, Ctrl+W, Ctrl+1-4) |
| **Navigation** | File tree | Expand/collapse, keyboard nav, arrow-key auto-select |
| **Folders** | Native picker | Open any directory on your system |
| **Sorting** | Flexible | Sort by name (A-Z / Z-A) or modification time (newest / oldest) |
| **Filter** | Filename | Instantly narrow down files by typing |
| **Watch** | Live reload | Sidebar and content update when files change on disk |
| **Help** | Built-in | Click the `?` button for an embedded user guide |
| **State** | Persistence | Remembers folder, file, panes, and sort mode across sessions |
| **Platforms** | Cross-platform | Windows, macOS, and Linux |

## Getting Started

### Prerequisites (all platforms)

- [Node.js](https://nodejs.org/) v20+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [GitHub CLI](https://cli.github.com/) (`gh`) — for releases only

<details>
<summary><strong>Windows</strong></summary>

- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10/11)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload

</details>

<details>
<summary><strong>macOS</strong></summary>

- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

</details>

<details>
<summary><strong>Linux</strong></summary>

Install the required system libraries:

**Debian / Ubuntu:**
```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
```

**Arch:**
```bash
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

</details>

### Install dependencies

```bash
npm install
```

### Development

```bash
npx tauri dev
```

This starts both the Vite dev server (with hot reload) and the Tauri native window.

### Build

```bash
npx tauri build
```

Build output by platform:

| Platform | Artifacts | Location |
|----------|-----------|----------|
| Windows  | NSIS installer (.exe), MSI installer | `src-tauri/target/release/bundle/nsis/`, `msi/` |
| macOS    | DMG disk image, .app bundle | `src-tauri/target/release/bundle/dmg/`, `macos/` |
| Linux    | .deb package, AppImage | `src-tauri/target/release/bundle/deb/`, `appimage/` |

> **Note:** Tauri does not support cross-compilation. Each platform must be built on native hardware.

### Run tests

```bash
# Frontend tests (vitest)
npx vitest run

# Rust tests
cd src-tauri && cargo test

# Type checking
npx svelte-check
```

## Releasing

### Single platform (Windows)

```batch
release.bat 0.2.0
```

Builds the app, commits, pushes, and creates a GitHub Release with Windows installers.

### Multi-platform workflow

Each platform must be built on native hardware. Order doesn't matter — whichever runs first creates the release, the rest upload artifacts.

```bash
# 1. On Windows:
release.bat 0.2.0

# 2. On macOS:
git pull && ./release.sh 0.2.0

# 3. On Linux:
git pull && ./release.sh 0.2.0
```

Both scripts are safe to run — they contain no secrets and rely on your local `gh` CLI session for authentication.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri 2.10 |
| Frontend | Svelte 5 (runes), TypeScript |
| Bundler | Vite 6 |
| Backend | Rust |
| Markdown | marked + highlight.js |
| Editor | CodeMirror 6 (markdown mode, one-dark theme) |
| Diagrams | mermaid (flowcharts, etc.), svgbob (ASCII art) |
| File watching | notify (Rust, native OS APIs) |
| Testing | vitest + @testing-library/svelte, cargo test |

## Project Structure

```
src/                        # Frontend (Svelte + TypeScript)
  App.svelte                # Root component — pane state, folder selection
  lib/
    components/             # Sidebar, FileTree, FileTreeItem, MarkdownViewer,
                            # MarkdownEditor, EditablePane, ContentArea,
                            # SearchResults
    services/               # filesystem, persistence, markdown, tree-utils,
                            # sort, highlight
    types.ts
src-tauri/                  # Rust backend
  src/
    lib.rs                  # Tauri app setup
    models.rs               # FileEntry model
    commands/
      filesystem.rs         # Directory tree, file read/write, search, help content
      watcher.rs            # Native file system watcher
      diagram.rs            # svgbob ASCII → SVG conversion
docs/                       # In-app documentation (viewable in Glacimark)
release.bat                 # Windows release script
release.sh                  # macOS / Linux release script
```

## License

MIT
