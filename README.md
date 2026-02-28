# Planning Central

A desktop markdown viewer with Mermaid diagram support, built with **Tauri 2 + Svelte 5 + TypeScript**.

Browse, search, and read markdown documentation with live-rendered diagrams — all in a fast native app.

## Features

- **Markdown rendering** with syntax-highlighted code blocks, tables, and full formatting
- **Mermaid diagrams** rendered as live SVGs (flowcharts, sequence diagrams, ER diagrams, etc.)
- **File tree sidebar** with expand/collapse, keyboard navigation, and arrow-key auto-select
- **Native folder picker** — open any directory on your system
- **Sort controls** — sort files by name (A-Z / Z-A) or modification time (newest / oldest)
- **Filename filter** — instantly narrow down files by typing in the filter bar
- **Live file watching** — sidebar and content update automatically when files change on disk
- **Built-in help** — click the `?` button for a user guide embedded directly in the binary
- **Persistence** — remembers your last folder, selected file, and sort mode across sessions

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

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

Produces:
- `src-tauri/target/release/app.exe` — standalone executable
- `src-tauri/target/release/bundle/nsis/` — NSIS installer (recommended)
- `src-tauri/target/release/bundle/msi/` — MSI installer

### Run tests

```bash
# Frontend tests (vitest)
npx vitest run

# Rust tests
cd src-tauri && cargo test

# Type checking
npx svelte-check
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri 2.10 |
| Frontend | Svelte 5 (runes), TypeScript |
| Bundler | Vite 6 |
| Backend | Rust |
| Markdown | marked + highlight.js |
| Diagrams | mermaid |
| File watching | notify (Rust, native OS APIs) |
| Testing | vitest + @testing-library/svelte, cargo test |

## Project Structure

```
src/                        # Frontend (Svelte + TypeScript)
  App.svelte                # Root component
  lib/
    components/             # Sidebar, FileTree, FileTreeItem, MarkdownViewer
    services/               # filesystem, persistence, markdown, tree-utils, sort
    types.ts
src-tauri/                  # Rust backend
  src/
    lib.rs                  # Tauri app setup
    models.rs               # FileEntry model
    commands/
      filesystem.rs         # Directory tree, file reading, help content
      watcher.rs            # Native file system watcher
docs/                       # In-app documentation (viewable in Planning Central)
```

## License

MIT
