# Glacimark — Next Steps

## Project Context

Desktop markdown editor built with **Tauri 2.10 + Svelte 5 + TypeScript**. Has a split-pane CodeMirror editor with live previewk, native folder selector, file watching, keyboard navigation, Mermaid diagram rendering, scroll sync, active line highlighting, state persistence via localStorage, OS file associations for `.md` files, CLI support (`glacimark file.md`), single-instance handling, dual theming (Aurora/Glacier), drag-and-drop file organization, anchor/file link navigation, source line numbers, editor mermaid linting, and bundle code splitting with lazy-loaded dependencies.

### Current Version: 0.1.5

### Current Test Count: 724 frontend (25 test files) + 118 Rust = 842 total

### Key Files
- **Rust backend:** `src-tauri/src/` — `lib.rs`, `models.rs`, `commands/{mod,filesystem,watcher,diagram,jumplist}.rs`
- **Frontend:** `src/App.svelte` (root), `src/lib/components/` (Sidebar, FileTree, FileTreeItem, MarkdownViewer, ContentArea, EditablePane, MarkdownEditor, SearchResults, Toast, TableOfContents, Backlinks, TocPane, DocStats), `src/lib/services/` (filesystem, persistence, markdown, tree-utils, sort, highlight, codemirror-themes, mermaid-linter, mermaid-fixer, undo, toc, doc-stats, image-paste), `src/lib/types.ts`
- **Config:** `tauri.conf.json`, `vitest.config.ts`, `vite.config.ts`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`
- **Installer:** `src-tauri/windows/installer-hooks.nsh`
- **Tests:** 23 `.test.ts` files in `src/lib/`, Rust tests in `lib.rs` + `commands/{filesystem,diagram,jumplist}.rs`

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
28. **Mermaid Auto-Fix** — `mermaid-fixer.ts` auto-repairs missing diagram types, single-dash arrows, bare graph keywords, unclosed subgraphs. Viewer "Try Auto-Fix" link + editor wrench button (Ctrl+Shift+F). Toast feedback.
29. **Undo/Redo** — `UndoManager` with dual stacks, 50-entry cap, 10s coalescing. Covers create/delete/rename/move/save for files and folders. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y. Session-only.
30. **Delete to Recycle Bin** — `trash::delete()` for files and folders instead of permanent deletion
31. **Zoom** — Ctrl+=/−/0 and Ctrl+wheel, 50%–200% range, persisted, affects viewer + editor text only
32. **Table of Contents** — Ctrl+T sidebar panel, auto-generated from headings, active heading tracking via IntersectionObserver, persisted visibility
33. **Windows Jump List** — COM API for recent folders in taskbar right-click menu, `--open-folder` args, single-instance support
34. **Find & Replace Theming** — `@codemirror/search` styled for both Aurora and Glacier themes
35. **Wiki-style Links** — `[[filename]]` and `[[filename|alias]]` syntax with purple dashed underline styling
36. **Backlinks** — collapsible footer panel showing which files link to the current file via wiki-links
37. **Document Statistics** — Ctrl+I footer bar with word count, reading time, Flesch Reading Ease, FK Grade
38. **Image Paste/Drop** — Ctrl+V or drag-drop images into editor, auto-saved to `assets/` subfolder with markdown reference insertion
39. **Copy Path** — right-click context menu to copy full file/folder path to clipboard
40. **Multiple Windows** — Ctrl+Shift+N for independent windows, each with own sidebar/folder/panes
41. **Full Application Menu** — File/Edit/View/Help menus with all features exposed, native Cut/Copy/Paste/Select All, About dialog with version from package.json via Vite `define`
42. **Vim Motions** — optional `@replit/codemirror-vim` toggle in editor header, Normal/Insert/Visual modes with indicator, ex commands (`:w`, `:q`, `:wq`, `:set rnu`), persisted
43. **Copy to Clipboard** — hover-visible copy button on all `<pre>` blocks (code, mermaid, svgbob). Copies source text for diagrams, code text for code blocks. Checkmark feedback on click.

---

## High Priority

### ~~Full Application Menu~~ DONE
~~Fill out the native top menu bar (File, Edit, View, Help) with proper menu items and working accelerators.~~ Implemented: File (7 items), Edit (9 items incl. native Cut/Copy/Paste/Select All + Find/Replace), View (11 items), Help (3 items incl. About dialog). All accelerators wired. About dialog shows version via Vite `define`.

### ~~About Dialog~~ DONE
~~"About Glacimark" menu item opens a native OS dialog.~~ Implemented as part of the Full Application Menu feature above. Uses `message()` from `@tauri-apps/plugin-dialog` with version injected via `__APP_VERSION__` from `package.json`.

---

## Low Priority

### Viewer Highlighter Tool
A colored highlighter for marking up text in the viewer. Select text in the rendered preview, pick a highlight color from a small palette (yellow, green, blue, pink, orange), and the selection gets a persistent colored background. Writes back to the markdown source using the `<mark>` HTML tag with inline styles: `<mark style="background: #fef08a">highlighted text</mark>`. The `<mark>` tag is valid HTML that `marked` passes through by default, so highlights survive re-renders and are portable to other markdown viewers/editors. Color picker appears as a floating toolbar on text selection (similar to Medium/Notion). In edit mode, the raw `<mark>` tags are visible and editable. A "clear highlight" option removes the `<mark>` wrapper from selected text.

---

## Other Ideas for Future Iterations

- **Split pane resizing** — draggable dividers between panes
- **Export to PDF** — print/export the rendered markdown
- **Markdown toolbar** — bold, italic, heading, link buttons above editor
- **CLI linting script** — `npm run lint:mermaid -- docs/` for CI pipelines
- **Markdown templates** — new file offers template choices (meeting notes, project plan, etc.)
- **Highlight.js tree-shaking** — selective language imports to cut ~970 KB chunk to ~100-200 KB

---


## Self-Documenting Requirement

**`docs/How to Use Glacimark.md`** is the in-app user guide. Every time a new feature ships, update it. Users click the help button (?) to see up-to-date instructions rendered inside Glacimark itself.

**`docs/test.md`** is the rendering museum — update with each new feature so the user can manually test all rendering capabilities in one file.
