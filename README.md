# Planning Central

A desktop markdown viewer with Mermaid diagram support, built with **Tauri 2 + Svelte 5 + TypeScript**.

Browse, search, and read markdown documentation with live-rendered diagrams — all in a fast native app.

## Features

- **Markdown rendering** with syntax-highlighted code blocks, tables, and full formatting
- **Mermaid diagrams** rendered as live SVGs (flowcharts, sequence diagrams, ER diagrams, etc.)
- **ASCII art diagrams** via svgbob — write box-drawing characters or use `bob`/`svgbob` code blocks
- **Full-text search** across all markdown files with line-number results
- **Multi-pane layout** — open up to 4 files side-by-side (Ctrl+Click to open, Ctrl+W to close)
- **File tree sidebar** with expand/collapse, keyboard navigation, and arrow-key auto-select
- **Native folder picker** — open any directory on your system
- **Sort controls** — sort files by name (A-Z / Z-A) or modification time (newest / oldest)
- **Filename filter** — instantly narrow down files by typing in the filter bar
- **Live file watching** — sidebar and content update automatically when files change on disk
- **Built-in help** — click the `?` button for a user guide embedded directly in the binary
- **Persistence** — remembers your last folder, selected file, open panes, and sort mode across sessions
- **Cross-platform** — Windows, macOS, and Linux

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
| Diagrams | mermaid (flowcharts, etc.), svgbob (ASCII art) |
| File watching | notify (Rust, native OS APIs) |
| Testing | vitest + @testing-library/svelte, cargo test |

## Project Structure

```
src/                        # Frontend (Svelte + TypeScript)
  App.svelte                # Root component — pane state, folder selection
  lib/
    components/             # Sidebar, FileTree, FileTreeItem, MarkdownViewer,
                            # ContentArea, SearchResults
    services/               # filesystem, persistence, markdown, tree-utils,
                            # sort, highlight
    types.ts
src-tauri/                  # Rust backend
  src/
    lib.rs                  # Tauri app setup
    models.rs               # FileEntry model
    commands/
      filesystem.rs         # Directory tree, file reading, search, help content
      watcher.rs            # Native file system watcher
      diagram.rs            # svgbob ASCII → SVG conversion
docs/                       # In-app documentation (viewable in Planning Central)
release.bat                 # Windows release script
release.sh                  # macOS / Linux release script
```

## License

MIT
