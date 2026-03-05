# Glacimark — Next Steps

## Project Context

Desktop markdown editor built with **Tauri 2.10 + Svelte 5 + TypeScript**. Has a split-pane CodeMirror editor with live preview, native folder selector, file watching, keyboard navigation, Mermaid diagram rendering, scroll sync, active line highlighting, state persistence via localStorage, OS file associations for `.md` files, CLI support (`glacimark file.md`), single-instance handling, dual theming (Aurora/Glacier), drag-and-drop file organization, anchor/file link navigation, source line numbers, editor mermaid linting, and bundle code splitting with lazy-loaded dependencies.

### Current Version: 0.0.3

### Current Test Count: 480 frontend (14 test files) + 97 Rust = 577 total

### Key Files
- **Rust backend:** `src-tauri/src/` — `lib.rs`, `models.rs`, `commands/{mod,filesystem,watcher,diagram,jumplist}.rs`
- **Frontend:** `src/App.svelte` (root), `src/lib/components/` (Sidebar, FileTree, FileTreeItem, MarkdownViewer, ContentArea, EditablePane, MarkdownEditor, SearchResults), `src/lib/services/` (filesystem, persistence, markdown, tree-utils, sort, highlight, codemirror-themes, mermaid-linter), `src/lib/types.ts`
- **Config:** `tauri.conf.json`, `vitest.config.ts`, `vite.config.ts`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`
- **Installer:** `src-tauri/windows/installer-hooks.nsh`
- **Tests:** 14 `.test.ts` files in `src/lib/`, Rust tests in `lib.rs` + `commands/{filesystem,diagram}.rs`

---

## Completed Features

All shipped and tested:

1. **Folder Selector** — native OS folder picker, persisted in localStorage
2. **Auto-Select First File** — auto-opens first file on folder switch
3. **Sort Controls** — name asc/desc, modified asc/desc with file metadata from Rust
4. **Filename Filter** — client-side tree filtering, auto-expand matches
5. **Full-Text Search** — Rust `search_files` command, debounced, grouped results with line numbers
6. **Widescreen Layout** — centered (max-width 800px) reading mode
7. **Multi-File Viewing** — up to 4 side-by-side panes, Ctrl+Click to split, Ctrl+W to close
8. **ASCII Art Diagrams** — svgbob Rust crate, auto-detects Unicode box-drawing
9. **Search Result Highlighting** — click result to scroll + highlight matching text in viewer/editor
10. **Markdown Editor** — split-pane CodeMirror 6 + live preview, auto-save 1s, Ctrl+S, scroll sync, active line highlight
11. **New File** — Ctrl+N, "+" button, inline input, auto `.md`, title template, opens in edit mode
12. **Rename File** — F2 / right-click, inline input, updates open panes
13. **Delete File/Folder** — Delete key / right-click, native confirm dialog, closes affected panes
14. **Save As** — Ctrl+Shift+S, native save dialog
15. **Folder Selection** — click folder to target it, visual highlight, folder icons
16. **Create Folder** — "📁+" button, inline input, auto-selects new folder
17. **Drag-and-Drop** — files and folders draggable onto directories, WebView2 stuck-drag fix
18. **Aurora/Glacier Theming** — CSS variables, CodeMirror themes, svgbob light mode, no-flash startup
19. **Anchor Link Scrolling** — heading IDs, smooth scroll, duplicate suffixes
20. **File Link Navigation** — `.md` links open files, external links open in browser, `file.md#section`
21. **Mermaid Validation** — per-block error overlays in viewer, status indicator
22. **Editor Mermaid Linting** — CodeMirror `@codemirror/lint` integration, wavy underlines on invalid blocks
23. **Source Line Numbers** — `1:` toggle, two-phase marked rendering with `data-source-line` attrs
24. **Editor Line Wrapping** — `⏎` toggle with CodeMirror Compartment, persisted
25. **Embedded Help File** — `include_str!` compiles help into binary
26. **Windows Jump List** — COM API for recent folders, `--open-folder` args
27. **Bundle Code Splitting** — lazy-loaded mermaid/CodeMirror/highlight.js/marked via dynamic imports and Vite manual chunks

---

## TODO: Mermaid Auto-Fix

### Problem
Mermaid blocks (especially AI-generated ones) often have subtle syntax errors. Layer 1 (viewer validation) and Layer 2 (editor linting) are done, but there's no auto-fix capability.

### Solution
An auto-fix system that detects and repairs common mermaid syntax mistakes.

**Common fixable patterns:**

| Problem | Example | Fix |
|---------|---------|-----|
| Missing diagram type | `A --> B` (no `graph` keyword) | Prepend `graph TD\n` |
| Wrong arrow syntax | `A -> B` (single dash) | Replace with `A --> B` |
| Spaces in node IDs | `My Node --> Other Node` | Wrap in quotes |
| Missing direction | `graph\n  A --> B` | Default to `graph TD` |
| Unclosed subgraph | `subgraph X\n  A --> B` | Append `end` |

**Implementation:**

New file `src/lib/services/mermaid-fixer.ts`:
- `fixMermaidBlock(text: string): FixResult` — fixes a single block
- `fixMermaidInMarkdown(markdown: string): { result: string; totalFixes: number }` — fixes all blocks in a document

**UI integration:**
- Editor toolbar button or `Ctrl+Shift+F` keybinding
- Viewer error banner gets a "Try Auto-Fix" button
- Toast notification: "Fixed 3 issues in 2 mermaid blocks"

**Tests (TDD):**
- `fixMermaidBlock` adds missing graph declaration
- `fixMermaidBlock` fixes single-dash arrows
- `fixMermaidBlock` closes unclosed subgraphs
- `fixMermaidBlock` returns empty changes for valid blocks
- `fixMermaidInMarkdown` fixes blocks within full markdown
- `fixMermaidInMarkdown` leaves non-mermaid code blocks untouched

---

## TODO: MCP Server for Claude Code Integration

### Vision
Expose Glacimark's capabilities as an MCP server so AI tools like Claude Code can read, write, validate, and search markdown docs programmatically.

### MCP Tools to Expose

| Tool | Description | Maps To |
|------|-------------|---------|
| `list_documents` | List all markdown files | `read_directory_tree` |
| `read_document` | Read a file's contents | `read_file_contents` |
| `write_document` | Write/update a file | `write_file_contents` |
| `search_documents` | Full-text search | `search_files` |
| `validate_mermaid` | Validate mermaid blocks | `mermaid.parse()` |
| `fix_mermaid` | Auto-fix mermaid errors | `fixMermaidInMarkdown()` |
| `get_document_outline` | Return heading structure | Parse headings |

### Architecture
Standalone Node.js MCP server (`mcp-server/` directory) using `@modelcontextprotocol/sdk`. Reads/writes directly to the docs folder. Independent of the Tauri app.

```json
{
  "mcpServers": {
    "glacimark": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js", "--docs-path", "./docs"]
    }
  }
}
```

**Tests:** list_documents, read_document, write_document, validate_mermaid, fix_mermaid, search_documents

---

## Other Ideas for Future Iterations

- **Split pane resizing** — draggable dividers between panes
- **Export to PDF** — print/export the rendered markdown
- **Table of contents** — auto-generated from headings, sidebar panel
- **Markdown toolbar** — bold, italic, heading, link buttons above editor
- **Vim/Emacs keybindings** — CodeMirror 6 extensions
- **CLI linting script** — `npm run lint:mermaid -- docs/` for CI pipelines
- **Image paste/drop** — paste images from clipboard, auto-save to disk
- **Markdown templates** — new file offers template choices (meeting notes, project plan, etc.)
- **Word count / reading time** — status bar indicator
- **Highlight.js tree-shaking** — selective language imports to cut ~970 KB chunk to ~100-200 KB

---

## Self-Documenting Requirement

**`docs/How to Use Glacimark.md`** is the in-app user guide. Every time a new feature ships, update it. Users click the help button (?) to see up-to-date instructions rendered inside Glacimark itself.

**`docs/test.md`** is the rendering museum — update with each new feature so the user can manually test all rendering capabilities in one file.
