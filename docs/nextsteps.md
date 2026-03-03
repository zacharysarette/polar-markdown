# Polar Markdown — Next Steps

## Project Context

Desktop markdown editor built with **Tauri 2.10 + Svelte 5 + TypeScript**. Has a split-pane CodeMirror editor with live preview, native folder selector (`tauri-plugin-dialog`), file watching, keyboard navigation, Mermaid diagram rendering, scroll sync, active line highlighting, state persistence via localStorage, OS file associations for `.md` files, CLI support (`polarmd file.md`), and single-instance handling (`tauri-plugin-single-instance`).

### Current Test Count: 312 frontend (13 test files) + 53 Rust = 365 total

### Key Files
- **Rust backend:** `src-tauri/src/` — `lib.rs` (InitialFileState, extract_file_arg, single-instance plugin), `models.rs`, `commands/{mod,filesystem,watcher,diagram}.rs`
- **Frontend:** `src/App.svelte` (root), `src/lib/components/` (Sidebar, FileTree, FileTreeItem, MarkdownViewer, ContentArea, EditablePane, MarkdownEditor, SearchResults), `src/lib/services/` (filesystem, persistence, markdown, tree-utils, sort, highlight), `src/lib/types.ts`
- **Config:** `tauri.conf.json` (mainBinaryName, fileAssociations, NSIS hooks), `vitest.config.ts`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`
- **Installer:** `src-tauri/windows/installer-hooks.nsh` (NSIS hooks for PATH add/remove)
- **Tests:** 13 `.test.ts` files in `src/lib/`, Rust tests in `lib.rs` + `commands/{filesystem,diagram}.rs`

### Environment Notes
- **Node v20.11.1** — too old for Vite 7 / @sveltejs/vite-plugin-svelte v6. Use Vite 6 + plugin v5.
- **happy-dom** for vitest (not jsdom)
- **Svelte 5 runes** — `$state()`, `$derived()`, `$effect()`, `$props()`
- **vitest config** needs `resolve.conditions: ["browser"]` for Svelte 5
- **Shell "Permission denied"** on every command due to bash profile bug with spaces in username path. Commands succeed despite exit code 1. Ignore it.
- **Tauri capabilities:** `core:default` + `dialog:default` in `capabilities/default.json`. Add more permissions there for new plugins.
- **User prefers TDD workflow:** Write tests first (red), implement (green), verify full suite.

---

## PRIORITY 0: Embed Help File in Binary

### Status: DONE

### Problem
The help button loads `How to Use Polar Markdown.md` from the app's `docs/` folder at runtime using `get_docs_path()`. This only works if the docs folder exists relative to the executable. When the app is installed to Program Files or run from a different location, the help file may not be found.

### Solution: Rust `include_str!`
Compile the help file directly into the binary at build time using Rust's `include_str!` macro. This reads the file at compile time and embeds it as a string constant in the executable. No runtime file access needed.

```rust
// In commands/filesystem.rs
const HELP_CONTENT: &str = include_str!("../../docs/How to Use Polar Markdown.md");

#[tauri::command]
pub fn get_help_content() -> String {
    HELP_CONTENT.to_string()
}
```

The frontend calls `invoke("get_help_content")` instead of reading a file path. Works from anywhere — installed, portable, any folder.

**Trade-off:** The help content is frozen at build time. Any edits to the `.md` file require a rebuild. This is fine since the file only changes when we ship new features (which requires a rebuild anyway).

---

## PRIORITY 1: Auto-Select First File on Folder Open

### Status: DONE

### Problem
When the user opens a new folder via the folder selector (or on first app launch with no saved selection), the content pane shows the empty state ("Select a markdown file..."). The user has to manually click a file to see anything. This feels broken — you pick a folder and nothing happens.

### Expected Behavior
When a folder is loaded and there's no previously-selected file to restore, the app should automatically select and display the first file in the tree.

### Root Cause
In `src/App.svelte`, the `switchToFolder()` function and the `onMount` flow only restore a file if `getLastSelectedPath()` returns a path that exists in the new tree. When switching to a brand new folder (or on first launch), there's no saved path, so nothing gets selected.

### Fix Location
`src/App.svelte` — two places need the same logic:

1. **`switchToFolder()`** — after `loadTree()`, if no last-selected file was restored, auto-select the first file
2. **`onMount`** — same: after tree loads and last-selected restore fails, auto-select first file

### Helper Needed
A utility to find the first file (not directory) in the tree, respecting the sort order:

```typescript
function findFirstFile(entries: FileEntry[]): FileEntry | undefined {
  for (const entry of entries) {
    if (!entry.is_directory) return entry;
    const found = findFirstFile(entry.children);
    if (found) return found;
  }
  return undefined;
}
```

### Implementation
In both `switchToFolder()` and the `onMount` flow, after the last-selected restore attempt:

```typescript
// Restore last selected file if it exists in the new tree
const lastPath = getLastSelectedPath();
if (lastPath && findEntryByPath(tree, lastPath)) {
  await loadFile(lastPath);
} else {
  // Auto-select the first file in the tree
  const firstFile = findFirstFile(tree);
  if (firstFile) {
    await loadFile(firstFile.path);
    saveLastSelectedPath(firstFile.path);
  }
}
```

### Tests to Write (TDD — write these FIRST)

**tree-utils.test.ts** (3 new tests):
- `findFirstFile` returns first non-directory entry
- `findFirstFile` recurses into directories to find files
- `findFirstFile` returns undefined for empty tree

*Note: Testing the App.svelte auto-select behavior directly is hard (requires mocking Tauri invoke). The utility function should be tested in isolation, and the integration verified manually.*

---

## Feature: Folder Selector

### Problem
The app currently only reads from a `docs/` folder discovered via `get_docs_path()` in Rust. Users can't choose a different folder.

### Solution
Add a native folder picker dialog so users can browse any directory on their system. Persist the chosen folder path so it's remembered across sessions.

### Implementation Plan

#### 1. Add Tauri Dialog Plugin (Rust side)

In `src-tauri/Cargo.toml`, add:
```toml
[dependencies]
tauri-plugin-dialog = "2"
```

In `src-tauri/src/lib.rs`, register the plugin:
```rust
.plugin(tauri_plugin_dialog::init())
```

In `src-tauri/capabilities/default.json`, add the permission:
```json
"permissions": [
  "core:default",
  "dialog:default"
]
```

#### 2. Add Frontend Dialog Integration

Install the JS package:
```bash
npm install @tauri-apps/plugin-dialog
```

Create a function in `src/lib/services/filesystem.ts` (or a new `dialog.ts`):
```typescript
import { open } from "@tauri-apps/plugin-dialog";

export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select markdown folder",
  });
  return selected as string | null;
}
```

#### 3. Persist Selected Folder

Extend `src/lib/services/persistence.ts` with:
- `saveDocsFolder(path: string): void`
- `getDocsFolder(): string | null`

Use a separate localStorage key like `"polar-markdown:docs-folder"`.

#### 4. Update App.svelte

The `onMount` flow becomes:
1. Check persistence for a saved docs folder
2. If none saved, call `get_docs_path()` as fallback (current behavior)
3. Load the tree from whichever path is active
4. On folder change, save new path, reload tree, clear selected file

Add a "Change Folder" button/action — either in the sidebar header or a toolbar.

#### 5. Update Sidebar UI

Add a folder picker trigger to `Sidebar.svelte`'s header area:
```svelte
<header class="sidebar-header">
  <h2>Files</h2>
  <button onclick={onchangefolder} title="Change folder">📁</button>
</header>
```

Pass `onchangefolder` callback from App.svelte.

#### 6. Tests to Write (TDD — write these FIRST)

**persistence.test.ts** (2 new tests):
- `saveDocsFolder` saves folder path to localStorage
- `getDocsFolder` returns stored folder or null

**filesystem.test.ts** (1 new test):
- `pickFolder` calls the dialog open function (mock `@tauri-apps/plugin-dialog`)

**Sidebar.test.ts** (2 new tests):
- Renders a "Change folder" button
- Calls `onchangefolder` callback when button clicked

**FileTree.test.ts** (1 new test):
- Clears focusedPath when entries change (tree reload on folder switch)

---

## File Watching: How It Works (Already Implemented)

The app **already detects new, modified, and deleted files automatically** — no polling, no restart needed.

### Architecture

```
OS Kernel (ReadDirectoryChangesW on Windows)
  → notify crate (RecommendedWatcher, recursive)
    → Rust callback filters for Create/Modify/Remove events
      → Tauri emits "file-changed" event with affected paths
        → App.svelte listener calls loadTree() to refresh sidebar
          → If the selected file was modified, its content reloads too
```

### What's in `src-tauri/src/commands/watcher.rs`
- Uses `notify::RecommendedWatcher` which hooks into the **native OS file system notification API** (not polling)
- Watches the entire docs folder recursively (`RecursiveMode::Recursive`)
- Filters for `EventKind::Create`, `EventKind::Modify`, `EventKind::Remove` — ignores access/metadata-only events
- Emits a `"file-changed"` Tauri event containing the list of affected file paths

### What's in `src/App.svelte`
- Calls `startWatching(docsPath)` on mount
- Listens for `"file-changed"` events via `listen<string[]>("file-changed", callback)`
- On every event: reloads the full directory tree (`loadTree()`)
- If the currently-selected file is in the changed paths list, also reloads its content

### Real-World Scenario
If Claude Code writes a new `.md` file into the watched folder, within ~100ms the sidebar will update to show the new file. If Claude modifies a file you're currently viewing, the content pane refreshes automatically.

### Gap: Folder Selector Must Restart the Watcher
When the folder selector feature is implemented (above), switching folders needs to:
1. Call `startWatching(newPath)` — the Rust side already handles this by dropping the old watcher and creating a new one (`*watcher_guard = None` then re-creates)
2. This is already handled in the existing code! The `start_watching` command drops any existing watcher before creating a new one. Just call it with the new path from the frontend.

### Potential Improvement: Debounce Rapid Events
When a tool like Claude Code writes multiple files in quick succession, the watcher may fire many events in a short window. Each one triggers a full `loadTree()`. A debounce (e.g., 200ms) could batch these into a single tree reload. This isn't critical yet but would be a nice optimization:

```typescript
// In App.svelte, debounced version:
let reloadTimeout: ReturnType<typeof setTimeout>;
unlistenFn = await listen<string[]>("file-changed", async (event) => {
  clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(async () => {
    await loadTree();
    if (selectedPath && event.payload.some((p) => p === selectedPath)) {
      await loadFile(selectedPath);
    }
  }, 200);
});
```

**Test for debounce (TDD):** Mock the timer, fire 5 rapid events, assert `loadTree` is only called once after the debounce settles.

---

## How to Get a Clickable Windows Binary

**You already have one!** The Tauri build (`npx tauri build`) produces three outputs:

### Option A: Standalone EXE (simplest)
```
src-tauri\target\release\polarmd.exe
```
Copy this file to your Desktop. Double-click to run. You can also pass a file path: `polarmd.exe path\to\file.md`.

### Option B: NSIS Installer (recommended for distribution)
```
src-tauri\target\release\bundle\nsis\Polar Markdown_0.5.1_x64-setup.exe
```
Double-click this to install the app to Program Files with a Start Menu shortcut and Desktop shortcut. Includes an uninstaller. The installer also:
- Registers `.md` file associations (right-click → "Open with Polar Markdown")
- Adds the install directory to your PATH so you can run `polarmd` from any terminal

### Option C: MSI Installer (enterprise/IT deployment)
```
src-tauri\target\release\bundle\msi\Polar Markdown_0.5.1_x64_en-US.msi
```
Standard Windows Installer package, good for Group Policy deployment.

### Rebuild Command
After any code changes:
```bash
npx tauri build
```
This compiles both the frontend (Vite) and Rust backend, then packages everything. Takes ~30 seconds.

### Run Tests + Type Check + Build (full pipeline)
```bash
npx vitest run && npx svelte-check && npx tauri build
```

---

## Feature: Sort Controls

### Problem
Files are currently sorted with a fixed rule: directories first, then alphabetical by name (case-insensitive). Users have no way to change this.

### Solution
Add sort controls to the sidebar header. Support multiple sort modes that apply to the file tree.

### Sort Modes
1. **Name A-Z** (current default)
2. **Name Z-A**
3. **Recently modified first** — requires passing modification timestamps from Rust
4. **Recently modified last**

### Implementation Plan

#### 1. Extend FileEntry with Metadata (Rust)

Update `src-tauri/src/models.rs` to include a `modified` timestamp:
```rust
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Vec<FileEntry>,
    pub modified: Option<u64>,  // Unix timestamp in seconds
}
```

In `commands/filesystem.rs` `build_tree()`, populate it from `fs::metadata().modified()`.

#### 2. Update Frontend Type

In `src/lib/types.ts`:
```typescript
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  children: FileEntry[];
  modified?: number;
}
```

#### 3. Add Sort State and Logic

New file `src/lib/services/sort.ts`:
```typescript
export type SortMode = "name-asc" | "name-desc" | "modified-desc" | "modified-asc";

export function sortEntries(entries: FileEntry[], mode: SortMode): FileEntry[] {
  // Deep sort: sort children recursively, directories always first
}
```

#### 4. UI: Sort Toggle in Sidebar Header

Add a sort dropdown or cycle button next to the "Files" heading. Persist the chosen sort mode via `persistence.ts`.

#### 5. Tests to Write (TDD)

**sort.test.ts** (new file, ~6 tests):
- Sorts by name ascending (default)
- Sorts by name descending
- Sorts by modified descending (newest first)
- Sorts by modified ascending (oldest first)
- Directories always come before files regardless of sort mode
- Recursively sorts children

**Sidebar.test.ts** (2 new tests):
- Renders sort control
- Calls sort change callback when toggled

**persistence.test.ts** (2 new tests):
- `saveSortMode` / `getSortMode` round-trip

**Rust tests** (2 new tests):
- `FileEntry` includes `modified` field
- `build_tree` populates `modified` from file metadata

---

## Feature: Search & Filter (Two Phases)

### Phase 1: Filename Filter

Fast, client-side filtering of the file tree by filename. No backend changes needed.

#### Problem
With many files, scrolling/scanning the tree is slow. Users need to quickly narrow down to a file by typing part of its name.

#### Solution
Add a search/filter input at the top of the sidebar. As the user types, the tree filters to show only entries whose filename matches the query. Directories are shown if they contain any matching descendants.

#### Implementation Plan

**1. Add Filter Input to Sidebar**

Add a text input above the FileTree in `Sidebar.svelte`:
```svelte
<input
  type="text"
  placeholder="Filter files..."
  bind:value={filterQuery}
  class="filter-input"
/>
```

Pass the filter query down to FileTree, or filter at the Sidebar/App level before passing entries.

**2. Filter Logic — New Utility**

New function in `src/lib/services/tree-utils.ts`:
```typescript
export function filterEntries(entries: FileEntry[], query: string): FileEntry[] {
  // Case-insensitive match on entry.name
  // Keep directories if any child matches (recursively prune)
  // Return empty array if no matches
}
```

**3. Auto-expand matches**

When filtering, auto-expand all directories so matched files are visible. Reset expansion state when filter is cleared.

**4. Keyboard shortcut**

`Ctrl+F` or `/` focuses the filter input. `Escape` clears the filter and returns focus to the file tree.

**5. Tests to Write (TDD)**

**tree-utils.test.ts** (5 new tests):
- Filters files by partial name match (case-insensitive)
- Keeps parent directories of matching files
- Returns empty array when nothing matches
- Returns full tree when query is empty
- Handles nested matches (grandchild files)

**Sidebar.test.ts** (2 new tests):
- Renders filter input
- Filter input updates the displayed entries

**FileTree.test.ts** (1 new test):
- All directories are expanded when filter is active

---

### Phase 2: Full-Text Search (Across All Files)

#### Status: DONE

Search the **contents** of all markdown files in the selected folder. This requires backend support since reading all files on the frontend would be slow.

#### Problem
Users know a keyword is *somewhere* in their docs but don't know which file. Filename filtering won't help here.

#### Solution
Add a Rust command that searches file contents, returning matching file paths and context snippets. Display results in a search results panel.

#### Implementation Plan

**1. New Rust Command: `search_files`**

In `src-tauri/src/commands/filesystem.rs`:
```rust
#[derive(Serialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Serialize)]
pub struct SearchMatch {
    pub line_number: usize,
    pub line_content: String,
}

#[tauri::command]
pub fn search_files(path: String, query: String) -> Result<Vec<SearchResult>, String> {
    // Walk directory with walkdir
    // Read each .md file, search line-by-line (case-insensitive)
    // Return files with matching lines and context
}
```

The `walkdir` crate is already a dependency — use it here.

**2. Frontend Search Service**

In `src/lib/services/filesystem.ts`:
```typescript
export async function searchFiles(path: string, query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_files", { path, query });
}
```

**3. Search Results UI**

Two possible approaches:
- **Option A:** Replace the file tree with search results when a search is active
- **Option B:** Show results in a separate panel/tab alongside the tree

Recommend Option A for simplicity — the sidebar shows either the tree or search results, toggled by whether the search input has a full-text query.

Each result shows the filename and matching line snippets. Clicking a result navigates to that file (and ideally scrolls to the match).

**4. Debounce the Search**

Full-text search is heavier than filename filtering. Debounce by 300ms so we're not hammering Rust on every keystroke.

**5. Search Mode Toggle**

The filter input could have a toggle or mode indicator:
- Default mode: filename filter (Phase 1, client-side, instant)
- Toggle to: full-text search (Phase 2, backend, debounced)

Or detect automatically: if the query starts with `/` or a special prefix, do full-text; otherwise filename filter.

**6. Tests to Write (TDD)**

**Rust tests** (4 new tests):
- `search_files` returns matching files with line numbers
- `search_files` is case-insensitive
- `search_files` returns empty vec when no matches
- `search_files` skips non-.md files and hidden directories

**filesystem.test.ts** (1 new test):
- `searchFiles` calls invoke with correct command and args

**New component test or Sidebar.test.ts** (3 new tests):
- Search results display file names and matching lines
- Clicking a search result calls onselect
- Clearing search returns to normal tree view

---

## How to Get a Clickable Windows Binary

**You already have one!** The Tauri build (`npx tauri build`) produces three outputs:

### Option A: Standalone EXE (simplest)
```
src-tauri\target\release\polarmd.exe
```
Copy this file to your Desktop. Double-click to run. You can also pass a file path: `polarmd.exe path\to\file.md`.

### Option B: NSIS Installer (recommended for distribution)
```
src-tauri\target\release\bundle\nsis\Polar Markdown_0.5.1_x64-setup.exe
```
Double-click this to install the app to Program Files with a Start Menu shortcut and Desktop shortcut. Includes an uninstaller. The installer also:
- Registers `.md` file associations (right-click → "Open with Polar Markdown")
- Adds the install directory to your PATH so you can run `polarmd` from any terminal

### Option C: MSI Installer (enterprise/IT deployment)
```
src-tauri\target\release\bundle\msi\Polar Markdown_0.5.1_x64_en-US.msi
```
Standard Windows Installer package, good for Group Policy deployment.

### Rebuild Command
After any code changes:
```bash
npx tauri build
```
This compiles both the frontend (Vite) and Rust backend, then packages everything. Takes ~30 seconds.

### Run Tests + Type Check + Build (full pipeline)
```bash
npx vitest run && npx svelte-check && npx tauri build
```

---

## Feature: ASCII Art Diagram Rendering (svgbob)

### Status: DONE

### Problem
ASCII art diagrams in markdown (file trees, box layouts, tables) render as plain monospace text. They look okay for editing but could be much more visually polished.

### Solution
Integrated **svgbob** (Rust crate, 4.1k stars) to convert ASCII art into clean SVGs. Since we already have a Rust backend, the integration is native — no WASM needed.

### How It Works
- Code blocks tagged with `bob`, `svgbob`, or `ascii-diagram` are detected by the marked.js renderer
- Content is sent to the Rust backend via `render_ascii_diagram` Tauri command
- svgbob converts ASCII to SVG; a pre-processor converts Unicode box-drawing characters (`├ └ ┌ ─ │`) to svgbob equivalents (`+ - |`)
- SVGs are injected into the DOM, styled for dark theme

### Files Changed
- `src-tauri/Cargo.toml` — added `svgbob = "0.7"`
- `src-tauri/src/commands/diagram.rs` — NEW: `normalize_box_drawing()` + `render_ascii_diagram` command
- `src-tauri/src/commands/mod.rs` — registered diagram module
- `src-tauri/src/lib.rs` — registered command
- `src/lib/services/filesystem.ts` — added `renderAsciiDiagram()` invoke
- `src/lib/services/markdown.ts` — bob code block detection + `renderBobDiagrams()`
- `src/lib/components/MarkdownViewer.svelte` — calls `renderBobDiagrams()` after DOM update
- `src/app.css` — dark theme styling for rendered SVGs

### Research Notes
Other libraries considered: typograms (archived), markdeep (monolithic), ditaa (Java-only), goat (Go-only). svgbob was the clear winner for a Tauri/Rust stack.

---

## Feature: Widescreen Reading Layout

### Status: DONE

### Problem
On widescreen/ultrawide monitors, the markdown content stretches across the full width of the viewport. The `.markdown-body` has no `max-width` and the app grid is `280px 1fr`, so text lines can be 200+ characters wide — far beyond the ~80 character comfort zone for reading. There's massive wasted horizontal space.

### Current Layout (from screenshot)
```
┌──────────┬─────────────────────────────────────────────────────────────┐
│ Sidebar  │  Content stretches allllll the way across...               │
│ 280px    │  ...with huge empty space on long lines                    │
│          │                                                             │
│          │                                                             │
│          │                                                             │
│          │                                                             │
└──────────┴─────────────────────────────────────────────────────────────┘
```

### Solution: Three Reading Modes

Give users a layout toggle in the viewer header with three modes:

#### Mode 1: Single Column (Centered)
Classic article layout — cap content width, center it.
```
┌──────────┬─────────────────────────────────────────────────────────────┐
│ Sidebar  │         ┌──────────────────────┐                           │
│          │         │  Content, max 800px  │                           │
│          │         │  centered in pane    │                           │
│          │         │  vertical scroll     │                           │
│          │         └──────────────────────┘                           │
└──────────┴─────────────────────────────────────────────────────────────┘
```
- Add `max-width: 800px; margin: 0 auto;` to `.markdown-body`
- Simplest fix, good default for normal monitors too

#### Mode 2: Multi-Column (Newspaper/Snaking)
CSS columns — content fills the viewport height in column 1, then snakes to column 2, etc. Horizontal scroll instead of vertical.
```
┌──────────┬──────────────────┬──────────────────┬──────────────────┐
│ Sidebar  │  Column 1        │  Column 2        │  Column 3        │
│          │  Content starts  │  ...continues    │  ...continues    │
│          │  here, flows     │  here after col  │  here, scroll    │
│          │  down to bottom  │  1 is full       │  right for more  │
└──────────┴──────────────────┴──────────────────┴──────────────────┘
```
- Uses CSS `column-width: 600px; column-gap: 32px; column-fill: auto`
- Container switches from `overflow-y: auto` to `overflow-x: auto`
- Need `break-inside: avoid` on headings, code blocks, tables, blockquotes, lists to prevent ugly mid-element column breaks
- Browser auto-calculates column count based on available width
- On a typical ultrawide (~3440px minus 280px sidebar), you'd get 4-5 columns

#### Mode 3: Paginated (Book-Style)
Content split into fixed-size pages, navigate with arrow keys or page buttons.
```
┌──────────┬──────────────────┬──────────────────┬──────────────────┐
│ Sidebar  │  ┌─── Page ───┐  │  ┌─── Page ───┐  │                  │
│          │  │  Content    │  │  │  Content    │  │   (empty or     │
│          │  │  page 1     │  │  │  page 2     │  │    next pages)  │
│          │  └─────────────┘  │  └─────────────┘  │                  │
│          │        < Page 1 of 5 >                                   │
└──────────┴──────────────────────────────────────────────────────────┘
```
- More complex — requires measuring content and splitting at page boundaries
- Could reuse CSS columns with `column-count: 2` (fixed) + pagination controls
- Nice for long-form reading but harder to implement

**Recommendation:** Start with Mode 1 (centered) as the default, then add Mode 2 (newspaper) as the widescreen power-user mode. Mode 3 (paginated) is optional/future.

### Implementation Plan

#### 1. Layout Mode State

Add a layout mode type and persistence:

```typescript
// In types.ts or a new layout.ts
export type LayoutMode = "centered" | "columns";
```

In `persistence.ts`:
- `saveLayoutMode(mode: LayoutMode): void`
- `getLayoutMode(): LayoutMode` (default: `"centered"`)

#### 2. Update MarkdownViewer Component

`MarkdownViewer.svelte` receives a `layoutMode` prop and applies the right CSS class:

```svelte
<article class="markdown-body" class:centered={layoutMode === "centered"} class:columns={layoutMode === "columns"}>
  {@html htmlContent}
</article>
```

CSS for centered mode:
```css
.markdown-body.centered {
  max-width: 800px;
  margin: 0 auto;
  overflow-y: auto;
}
```

CSS for columns mode:
```css
.markdown-body.columns {
  column-width: 550px;
  column-gap: 40px;
  column-fill: auto;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
}

.markdown-body.columns h1,
.markdown-body.columns h2,
.markdown-body.columns h3,
.markdown-body.columns h4,
.markdown-body.columns pre,
.markdown-body.columns blockquote,
.markdown-body.columns table,
.markdown-body.columns ul,
.markdown-body.columns ol,
.markdown-body.columns .mermaid {
  break-inside: avoid;
}
```

#### 3. Layout Toggle UI

Add a toggle control in the viewer header next to the filename:
```svelte
<header class="viewer-header">
  <span class="file-name">{fileName}</span>
  <div class="layout-controls">
    <button class:active={layoutMode === "centered"} onclick={() => setLayout("centered")} title="Single column">≡</button>
    <button class:active={layoutMode === "columns"} onclick={() => setLayout("columns")} title="Multi-column">⊞</button>
  </div>
</header>
```

#### 4. Tests to Write (TDD)

**MarkdownViewer.test.ts** (3 new tests):
- Renders with `centered` class when layoutMode is "centered"
- Renders with `columns` class when layoutMode is "columns"
- Defaults to centered when no layoutMode prop

**persistence.test.ts** (2 new tests):
- `saveLayoutMode` / `getLayoutMode` round-trip
- `getLayoutMode` returns "centered" as default

**Visual/integration testing note:** CSS column behavior can't be meaningfully tested in happy-dom (no real layout engine). Manual testing on an actual widescreen monitor is essential for this feature.

---

## Feature: Multi-File Viewing

### Status: DONE

### Problem
Currently the app can only display one file at a time. On a widescreen, users want to view multiple documents side by side — compare notes, reference one doc while reading another, etc.

### Solution
Support opening multiple files in side-by-side panes. Each pane is an independent MarkdownViewer. Users can open, close, and switch between panes.

### Target Layout
```
┌──────────┬──────────────────────────┬──────────────────────────┐
│ Sidebar  │  readme.md          [x]  │  plan.md             [x] │
│          │  ┌────────────────────┐   │  ┌────────────────────┐  │
│          │  │  # README          │   │  │  # Plan             │  │
│          │  │  Content...        │   │  │  Content...         │  │
│          │  │                    │   │  │                     │  │
│          │  └────────────────────┘   │  └────────────────────┘  │
└──────────┴──────────────────────────┴──────────────────────────┘
```

### Data Model Change

Currently in `App.svelte`:
```typescript
let selectedPath = $state("");
let fileContent = $state("");
```

Change to a multi-pane model:
```typescript
interface OpenPane {
  id: string;
  path: string;
  content: string;
}

let panes: OpenPane[] = $state([]);
let activePaneId = $state("");  // which pane has keyboard focus
```

### Implementation Plan

#### 1. New Component: `ContentArea.svelte`

Manages the pane layout. Replaces the direct `<MarkdownViewer>` in App.svelte.

```svelte
<!-- ContentArea.svelte -->
<div class="content-area" style="grid-template-columns: repeat({panes.length}, 1fr)">
  {#each panes as pane (pane.id)}
    <div class="pane" class:active={pane.id === activePaneId}>
      <header class="pane-header">
        <span class="pane-filename">{getFileName(pane.path)}</span>
        <button onclick={() => closePane(pane.id)} title="Close">×</button>
      </header>
      <MarkdownViewer content={pane.content} filePath={pane.path} {layoutMode} />
    </div>
  {/each}
</div>
```

The `content-area` uses CSS grid with equal-width columns that auto-adjust as panes are added/removed.

#### 2. Opening Files — Single Click vs Split

Two interaction patterns to support:
- **Single click** (or arrow key): Opens file in the active pane (replaces content) — current behavior preserved
- **Ctrl+Click** (or a "Split" button): Opens file in a **new pane** to the right

This keeps the simple default behavior but adds multi-file support as a power-user action.

#### 3. Pane Management

- **Close pane:** X button on pane header, or `Ctrl+W`
- **Switch active pane:** Click on a pane, or `Ctrl+1`/`Ctrl+2`/etc.
- **Max panes:** Cap at 3-4 to avoid tiny unusable panes. Show a notification if limit reached.
- **Last pane closed:** Show the empty state ("Select a markdown file...")
- **Pane resizing:** Optionally, make pane dividers draggable. Can defer to a later iteration — equal-width is fine for v1.

#### 4. Update File Watcher Integration

When a file changes, update ALL panes that have that file open (not just the "selected" one):
```typescript
listen<string[]>("file-changed", async (event) => {
  await loadTree();
  for (const pane of panes) {
    if (event.payload.some(p => p === pane.path)) {
      pane.content = await readFileContents(pane.path);
    }
  }
});
```

#### 5. Persistence

Save the list of open pane paths (not content) so they reopen on next launch:
- `saveOpenPanes(paths: string[]): void`
- `getOpenPanes(): string[]`

Restore them after tree loads, same as last-selected-file but for multiple files.

#### 6. Interaction with Layout Modes

Each pane has its own layout mode, or share a global one. Recommend global — simpler, and mixed modes would look chaotic.

When multiple panes are open:
- **Centered mode:** Each pane centers its content within its column — works naturally
- **Columns mode:** Probably should auto-switch to centered when 2+ panes are open (each pane is already narrow enough). Or let users decide.

#### 7. Tests to Write (TDD)

**ContentArea.test.ts** (new file, ~8 tests):
- Renders single pane with file content
- Renders multiple panes side by side
- Closes a pane when X button clicked
- Shows empty state when last pane closed
- Active pane has `.active` class
- Clicking a pane sets it as active
- File content updates when file changes (via props)
- Max pane limit respected

**App-level integration tests** (if feasible, or manual):
- Ctrl+Click opens new pane
- Single click replaces active pane content
- Pane state persists across sessions

**persistence.test.ts** (2 new tests):
- `saveOpenPanes` / `getOpenPanes` round-trip
- Returns empty array when nothing stored

---

## Feature: Markdown & Diagram Editor

### Status: DONE (v0.4.0)

Shipped in v0.4.0 with: split-pane CodeMirror 6 editor + live preview, auto-save (1s debounce) + Ctrl+S, bidirectional scroll sync, active line highlighting with table cell targeting, search highlighting in editor, watcher feedback loop prevention, image layout shift fix.

### Problem (original)
Polar Markdown is currently read-only. Users have to edit markdown files in a separate text editor, then switch back to see the rendered result. For a planning tool, editing should be built-in.

### Solution
Add a split-pane editor view: raw markdown editor on one side, live preview on the other. Includes Mermaid diagram editing with live-rendered previews.

### Editor Library: CodeMirror 6

**Why CodeMirror 6 over Monaco (VS Code's editor):**
- ~150KB vs ~2MB bundle size — important for a Tauri app
- Modular — only load what you need (markdown mode, syntax highlighting)
- Excellent mobile support (not relevant now but good architecture)
- First-class markdown extension with syntax highlighting
- Active development, well-documented

**Install:**
```bash
npm install codemirror @codemirror/lang-markdown @codemirror/theme-one-dark @codemirror/state @codemirror/view
```

### Editor Modes

The viewer header gets a toggle between **View** and **Edit** modes:

#### View Mode (current behavior)
```
┌──────────┬──────────────────────────────────────────┐
│ Sidebar  │  readme.md              [View] [Edit]     │
│          │  ┌──────────────────────────────────────┐ │
│          │  │  Rendered markdown (current)          │ │
│          │  └──────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────┘
```

#### Edit Mode (split: editor + preview)
```
┌──────────┬─────────────────────┬─────────────────────┐
│ Sidebar  │  Editor (raw md)    │  Preview (rendered)   │
│          │  # README           │  README               │
│          │                     │  ─────────            │
│          │  Some **bold** text │  Some bold text       │
│          │                     │                       │
│          │  ```mermaid         │  ┌──────────────┐    │
│          │  graph LR           │  │ A ──→ B ──→ C│    │
│          │    A --> B --> C     │  └──────────────┘    │
│          │  ```                │                       │
└──────────┴─────────────────────┴─────────────────────┘
```

### Implementation Plan

#### 1. New Rust Command: `write_file_contents`

In `src-tauri/src/commands/filesystem.rs`:
```rust
#[tauri::command]
pub fn write_file_contents(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))
}
```

Register in `lib.rs`'s `generate_handler![]`.

#### 2. Frontend Write Service

In `src/lib/services/filesystem.ts`:
```typescript
export async function writeFileContents(path: string, content: string): Promise<void> {
  return invoke<void>("write_file_contents", { path, content });
}
```

#### 3. New Component: `MarkdownEditor.svelte`

Wraps CodeMirror 6 with markdown mode:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView, basicSetup } from "codemirror";
  import { markdown } from "@codemirror/lang-markdown";
  import { oneDark } from "@codemirror/theme-one-dark";

  let { content, onchange }: { content: string; onchange: (value: string) => void } = $props();
  let editorContainer: HTMLDivElement;
  let view: EditorView;

  onMount(() => {
    view = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onchange(update.state.doc.toString());
          }
        }),
      ],
      parent: editorContainer,
    });
  });

  onDestroy(() => view?.destroy());
</script>

<div bind:this={editorContainer} class="editor-container"></div>
```

#### 4. New Component: `EditablePane.svelte`

Manages the split view for a single file in edit mode:

```svelte
<div class="editable-pane">
  <div class="editor-side">
    <MarkdownEditor content={rawContent} onchange={handleEdit} />
  </div>
  <div class="preview-side">
    <MarkdownViewer content={rawContent} filePath={filePath} layoutMode="centered" />
  </div>
</div>
```

The preview updates live as the user types (fed by the same `rawContent` state).

#### 5. Auto-Save with Debounce

Don't save on every keystroke — debounce writes:

```typescript
let saveTimeout: ReturnType<typeof setTimeout>;

function handleEdit(newContent: string) {
  rawContent = newContent;  // Updates preview immediately
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await writeFileContents(filePath, newContent);
  }, 1000);  // Save 1s after last keystroke
}
```

Also support `Ctrl+S` for immediate save.

#### 6. File Watcher Feedback Loop Prevention

Problem: when the editor saves a file, the watcher will detect the change and trigger a tree reload + content reload, potentially resetting the editor cursor position.

Solutions:
- **Approach A (simple):** Set a flag `isOwnWrite = true` before saving, check it in the watcher listener, clear it after. Skip reload if it's our own write.
- **Approach B (robust):** Compare content — if the watcher fires and the file content matches what's in the editor, skip the reload.

Recommend Approach A for simplicity:
```typescript
let isOwnWrite = false;

async function saveFile(content: string) {
  isOwnWrite = true;
  await writeFileContents(filePath, content);
  setTimeout(() => { isOwnWrite = false; }, 500);
}

// In watcher listener:
listen("file-changed", async (event) => {
  if (isOwnWrite) return;
  // ... normal reload logic
});
```

#### 7. Mermaid Diagram Editing

No special handling needed — the editor edits raw markdown including mermaid code blocks. The preview side renders them via the existing `renderMermaidDiagrams()` pipeline. As the user types mermaid syntax, the preview updates live.

For a better experience in a future iteration, could add:
- Syntax highlighting for mermaid blocks in the editor (CodeMirror extension)
- A "Diagram Helper" panel with mermaid syntax reference
- Drag-and-drop diagram node editing (very complex, future)

#### 8. Edit Mode per Pane (Interaction with Multi-File)

If multi-file viewing is implemented first, each pane can independently be in View or Edit mode. The toggle is per-pane, not global. This lets you edit one file while referencing another in view mode.

#### 9. Tests to Write (TDD)

**Rust tests** (2 new tests):
- `write_file_contents` creates/overwrites a file
- `write_file_contents` returns error for invalid path

**filesystem.test.ts** (1 new test):
- `writeFileContents` calls invoke with correct command and args

**MarkdownEditor.test.ts** (new file, ~4 tests):
- Renders an editor container element
- Calls `onchange` when content is modified
- Initializes with provided content
- Applies dark theme

**EditablePane.test.ts** (new file, ~4 tests):
- Renders editor and preview side by side
- Preview updates when editor content changes
- Save is debounced (mock timer, verify single write after settling)
- Ctrl+S triggers immediate save

**Integration/manual tests:**
- Editing a mermaid block updates the diagram in preview
- File watcher doesn't reset editor on own writes
- Cursor position preserved during auto-save

---

## Feature: New File Creation

### Status: DONE

### Problem
Users can edit existing files but cannot create new markdown files from within Polar Markdown. They have to use a separate file manager or terminal to create files, then switch back.

### Solution
Add a "New File" button to the sidebar header. Clicking it creates a new `.md` file in the current directory and opens it in edit mode.

### UX Flow

1. User clicks the **+** (new file) button in the sidebar header
2. An inline text input appears at the top of the file tree, pre-filled with `untitled.md`
3. User types a filename (auto-appends `.md` if not present)
4. Press **Enter** to create, **Escape** to cancel
5. If the filename already exists, show an error inline (red text below input)
6. On success: file is created on disk, sidebar refreshes, file opens in edit mode in the active pane

### Keyboard Shortcut
**Ctrl+N** — creates a new file (same flow as clicking the + button)

### Rust Backend
New command: `create_file(directory: String, filename: String) -> Result<String, String>`
- Validates filename (no path separators, no special chars)
- Checks if file already exists (returns error if so)
- Creates the file with a default template: `# {Title}\n\n` (title derived from filename)
- Returns the full path of the created file

### Subdirectory Support
If a directory is currently focused/selected in the file tree, the new file is created inside that directory rather than the root folder.

---

## Feature: Rename File

### Status: DONE

### Problem
To rename a markdown file, users must leave the app and use a file manager. This breaks the editing flow.

### Solution
Add a rename action accessible via right-click context menu or keyboard shortcut on files in the sidebar.

### UX Flow

1. User right-clicks a file in the sidebar and selects **Rename**, or presses **F2** while a file is focused
2. The file name in the tree becomes an editable text input, pre-filled with the current name
3. User edits the name and presses **Enter** to confirm, **Escape** to cancel
4. If the new name already exists, show an error inline
5. On success: file is renamed on disk, sidebar refreshes, all open panes pointing to the old path update to the new path

### Rust Backend
New command: `rename_file(old_path: String, new_name: String) -> Result<String, String>`
- Validates new name
- Checks for conflicts
- Renames via `std::fs::rename`
- Returns the new full path

### Edge Cases
- File is open in edit mode with unsaved changes → save first, then rename
- File is open in multiple panes → update all pane paths
- File is the persisted "last selected file" → update persistence

---

## Feature: Delete File

### Status: DONE

### Problem
Users must leave the app to delete files via File Explorer, breaking the workflow. Delete is the most obvious CRUD gap — Create, Rename, and Open exist but not Delete.

### Solution
- **Delete key** while a file is focused in the tree triggers deletion
- **Right-click context menu** includes a "Delete" option (red hover styling for visual warning)
- **Native OS confirmation dialog** via `tauri-plugin-dialog` `ask()` before deletion
- Rust `delete_file` command validates: file exists, is a file (not directory), is `.md`, no path traversal
- After deletion: close all panes showing the file, refresh tree, clear focused path if needed
- `recentOwnWrites` prevents watcher double-refresh

### Files Changed
- `src-tauri/src/commands/filesystem.rs` — `delete_file` command + 4 tests
- `src-tauri/src/lib.rs` — registered in invoke_handler
- `src/lib/services/filesystem.ts` — `deleteFile()` + `confirmDelete()` wrappers
- `src/lib/services/filesystem.test.ts` — 3 tests (deleteFile x2, confirmDelete x1)
- `src/App.svelte` — `handleDeleteFile` orchestration, `ondelete` prop to Sidebar
- `src/lib/components/FileTree.svelte` — Delete key handler, context menu "Delete" item, `ondelete` prop
- `src/lib/components/Sidebar.svelte` — pass-through `ondelete` prop

---

## Feature: Save As

### Status: DONE

### Problem
Users may want to save a copy of the current file under a different name or in a different location — for example, to create a template from an existing document.

### Solution
Add a **Save As** option that uses the native file save dialog to choose a destination, then writes the current content there.

### UX Flow

1. User presses **Ctrl+Shift+S** or selects Save As from a menu
2. A native save dialog opens (via `tauri-plugin-dialog`), pre-filled with the current filename
3. User picks a location and filename
4. Content is written to the new path
5. The active pane switches to the new file (new path, new title)
6. If the new file is inside the currently open folder, the sidebar refreshes to show it

### Rust Backend
Reuses existing `write_file_contents` command — no new backend needed. The frontend just needs to call it with the new path from the dialog.

### Dialog Integration
Uses `tauri-plugin-dialog`'s `save` dialog:
```typescript
import { save } from '@tauri-apps/plugin-dialog';
const path = await save({
  defaultPath: currentFileName,
  filters: [{ name: 'Markdown', extensions: ['md'] }],
});
```

---

## Feature: Folder Selection & Targeted File Creation

### Problem
When users click the "+" button to create a new file, they expect it to appear in whatever folder they're looking at. But clicking a folder only toggles its expand/collapse — it doesn't "select" the folder. The existing `focusedTreePath` variable (used by `handleCreateNewFile` to pick a target directory) only updates on arrow-key navigation, not mouse clicks. So the workflow **click folder → click "+"** creates the file in the root instead of the clicked folder.

Additionally, folders have no visual "selected" state. Files get a blue highlight when selected (`.selected` class), but folders only get green text (`.directory`) and a keyboard focus outline (`.focused`). There's no way for the user to see which folder is targeted for operations like "new file here."

Folders also lack a folder icon — files show 📄 but directories only show a chevron (▶/▼) with no icon, making it hard to visually distinguish folders from files at a glance.

### Current State (What Exists)

**`App.svelte` lines 411-419** — `handleCreateNewFile` already checks `focusedTreePath`:
```typescript
async function handleCreateNewFile(filename: string) {
  let targetDir = docsPath;
  if (focusedTreePath) {
    const entry = findEntryByPath(rawTree, focusedTreePath);
    if (entry?.is_directory) {
      targetDir = focusedTreePath;
    }
  }
  // ... creates file in targetDir
}
```

**`FileTreeItem.svelte` line 51-56** — clicking a directory only toggles:
```typescript
function handleClick(event: MouseEvent) {
  if (entry.is_directory) {
    ontoggle(entry.path);  // Only expands/collapses — never updates focusedTreePath
  } else {
    onselect(entry.path, event);
  }
}
```

**`FileTreeItem.svelte` line 139-143** — directories show only a chevron, no folder icon:
```svelte
{#if entry.is_directory}
  <span class="chevron">{expanded ? "▼" : "▶"}</span>
{:else}
  <span class="file-icon">📄</span>
{/if}
```

**`App.svelte` line 432-434** — `focusedTreePath` only set from keyboard:
```typescript
function handleFocusChange(path: string) {
  focusedTreePath = path;  // Called from FileTree keyboard nav, never from mouse clicks
}
```

### Solution

#### 1. Add `onfolderselect` callback to FileTreeItem
When a directory is clicked, call both `ontoggle` (expand/collapse) AND a new `onfolderselect` callback that propagates up to App.svelte:

```typescript
// FileTreeItem.svelte
function handleClick(event: MouseEvent) {
  if (entry.is_directory) {
    ontoggle(entry.path);
    onfolderselect?.(entry.path);  // NEW: also "select" the folder
  } else {
    onselect(entry.path, event);
  }
}
```

#### 2. Track `selectedFolderPath` in App.svelte
Add a new `selectedFolderPath` state variable. Set it when a folder is clicked, clear it when a file is selected:

```typescript
let selectedFolderPath = $state("");

function handleFolderSelect(path: string) {
  selectedFolderPath = path;
}

function handleSelectFile(path: string, event?: MouseEvent) {
  selectedFolderPath = "";  // Clear folder selection when a file is clicked
  // ... existing file selection logic
}
```

#### 3. Update `handleCreateNewFile` to use `selectedFolderPath`
Check `selectedFolderPath` first (mouse click), then `focusedTreePath` (keyboard nav):

```typescript
async function handleCreateNewFile(filename: string) {
  let targetDir = docsPath;
  // Mouse-clicked folder takes priority
  if (selectedFolderPath) {
    targetDir = selectedFolderPath;
  } else if (focusedTreePath) {
    const entry = findEntryByPath(rawTree, focusedTreePath);
    if (entry?.is_directory) {
      targetDir = focusedTreePath;
    }
  }
  // ...
}
```

#### 4. Add folder icon next to chevron
Directories currently only show a chevron. Add a 📁 folder icon between the chevron and the folder name so folders are immediately recognizable:

```svelte
<!-- FileTreeItem.svelte -->
{#if entry.is_directory}
  <span class="chevron">{expanded ? "▼" : "▶"}</span>
  <span class="folder-icon">📁</span>
{:else}
  <span class="file-icon">📄</span>
{/if}
```

```css
.folder-icon {
  font-size: 12px;
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}
```

This matches the existing `.file-icon` style so files and folders align consistently.

#### 6. Visual folder selection
Pass `selectedFolderPath` down through FileTree → FileTreeItem. Apply a CSS class:

```svelte
<!-- FileTreeItem.svelte -->
<button
  class="tree-row"
  class:selected={isSelected}
  class:folder-selected={entry.is_directory && entry.path === selectedFolderPath}
  class:directory={entry.is_directory}
  ...
>
```

```css
.tree-row.folder-selected {
  background: rgba(158, 206, 106, 0.15);  /* Green tint to match directory color */
  outline: 1px solid rgba(158, 206, 106, 0.4);
}
```

#### 7. Breadcrumb hint in the new-file input area
When `selectedFolderPath` is set and the user clicks "+", show the target folder name above the filename input:

```svelte
{#if creatingFile}
  {#if selectedFolderPath}
    <span class="create-target-hint">in {selectedFolderPath.split('/').pop()}/</span>
  {/if}
  <input ... />
{/if}
```

### Files to Modify
- `src/lib/components/FileTreeItem.svelte` — add `onfolderselect` prop + call on directory click, add `selectedFolderPath` prop + CSS class
- `src/lib/components/FileTree.svelte` — pass `onfolderselect` and `selectedFolderPath` through
- `src/lib/components/Sidebar.svelte` — pass `onfolderselect` and `selectedFolderPath` through
- `src/App.svelte` — add `selectedFolderPath` state, `handleFolderSelect`, update `handleCreateNewFile`, pass props
- `src/lib/components/Sidebar.svelte` — show breadcrumb hint when creating file in a specific folder

### Tests

**FileTreeItem.test.ts:**
- Clicking a directory calls `onfolderselect` with the directory path
- Clicking a directory still calls `ontoggle` (existing behavior preserved)
- Clicking a file does NOT call `onfolderselect`
- `folder-selected` CSS class applied when `selectedFolderPath` matches a directory entry
- Directory entries render a folder icon (📁) alongside the chevron
- File entries render a file icon (📄) but no folder icon

**FileTree.test.ts:**
- `onfolderselect` callback propagates from nested items

**Sidebar.test.ts:**
- Target folder hint shown when `selectedFolderPath` is set and creating file
- Target folder hint hidden when `selectedFolderPath` is empty

**App.svelte (integration):**
- Clicking a folder sets `selectedFolderPath`
- Selecting a file clears `selectedFolderPath`
- Creating a file with `selectedFolderPath` set uses that folder as target directory
- Creating a file with no `selectedFolderPath` falls back to `focusedTreePath` → `docsPath`

---

## Feature: Drag-and-Drop File Moving

### Problem
Users can't reorganize files by moving them between folders. The only way to move a file is to rename it (which only changes the filename, not its directory). The sidebar already has `ondragstart` on files (sets `text/plain` with the file path), but there are no drop targets — dragging a file does nothing.

### Current State (What Exists)

**`FileTreeItem.svelte` lines 59-63** — files are draggable, directories are not:
```typescript
function handleDragStart(event: DragEvent) {
  if (entry.is_directory || !event.dataTransfer) return;
  event.dataTransfer.setData("text/plain", entry.path);
  event.dataTransfer.effectAllowed = "copy";
}
```
```svelte
<button ... draggable={!entry.is_directory} ondragstart={handleDragStart}>
```

**No drop handling anywhere** — no `ondragover`, `ondrop`, `ondragleave` handlers on any element.

**No Rust `move_file` command** — `rename_file` only changes the filename within the same directory.

### Solution

#### Rust Backend: `move_file` Command

New Tauri command in `src-tauri/src/commands/filesystem.rs`:

```rust
#[derive(serde::Serialize)]
pub struct MoveFileResult {
    pub old_path: String,
    pub new_path: String,
}

#[tauri::command]
pub fn move_file(source_path: String, target_dir: String) -> Result<MoveFileResult, String> {
    let source = Path::new(&source_path);
    let target = Path::new(&target_dir);

    // Validation
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    if !source.is_file() {
        return Err("Can only move files, not directories".into());
    }
    if !source_path.to_lowercase().ends_with(".md") {
        return Err("Can only move markdown (.md) files".into());
    }
    if !target.exists() || !target.is_dir() {
        return Err(format!("Target directory does not exist: {}", target_dir));
    }
    if source_path.contains("..") || target_dir.contains("..") {
        return Err("Invalid path".into());
    }

    let filename = source.file_name()
        .ok_or("Cannot determine filename")?;
    let new_path = target.join(filename);

    if new_path.exists() {
        return Err(format!("A file named '{}' already exists in the target folder",
            filename.to_string_lossy()));
    }

    fs::rename(&source, &new_path)
        .map_err(|e| format!("Failed to move file: {}", e))?;

    Ok(MoveFileResult {
        old_path: source_path,
        new_path: new_path.to_string_lossy().into_owned(),
    })
}
```

Register in `src-tauri/src/commands/mod.rs` and add to `.invoke_handler()` in `lib.rs`.

#### Frontend: Drop Handlers on Directories

**`FileTreeItem.svelte`** — add drop zone behavior for directory entries:

```typescript
let dragOver = $state(false);

function handleDragOver(event: DragEvent) {
  if (!entry.is_directory) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = "move";
  dragOver = true;
}

function handleDragLeave() {
  dragOver = false;
}

function handleDrop(event: DragEvent) {
  if (!entry.is_directory) return;
  event.preventDefault();
  dragOver = false;
  const sourcePath = event.dataTransfer?.getData("text/plain");
  if (sourcePath && sourcePath !== entry.path) {
    onmovefile?.(sourcePath, entry.path);
  }
}
```

```svelte
<button
  class="tree-row"
  class:drag-over={dragOver}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  ...
>
```

**Visual feedback CSS:**
```css
.tree-row.drag-over {
  background: rgba(158, 206, 106, 0.25);
  outline: 2px dashed #9ece6a;
  outline-offset: -2px;
}
```

**Update drag start** — change `effectAllowed` from `"copy"` to `"move"`:
```typescript
event.dataTransfer.effectAllowed = "move";
```

#### Frontend Service: `moveFile()` wrapper

```typescript
// src/lib/services/filesystem.ts
export async function moveFile(sourcePath: string, targetDir: string): Promise<MoveFileResult> {
  return invoke<MoveFileResult>("move_file", { sourcePath, targetDir });
}
```

#### App.svelte: `handleMoveFile` orchestration

```typescript
async function handleMoveFile(sourcePath: string, targetDir: string) {
  try {
    const { old_path, new_path } = await moveFile(sourcePath, targetDir);

    // Update all open panes that had the old path
    panes = panes.map(p =>
      p.filePath === old_path ? { ...p, filePath: new_path } : p
    );

    // Prevent watcher double-refresh
    recentOwnWrites.add(new_path);
    setTimeout(() => recentOwnWrites.delete(new_path), 2000);

    await loadTree();
  } catch (e: any) {
    console.error("Move failed:", e);
    // Could show a toast/notification in the future
  }
}
```

#### Also allow dropping on the root sidebar area
Add a drop zone to the Sidebar component (or a dedicated "root drop area") that moves files to the docs root folder. This handles the case where users want to move a file OUT of a subfolder back to the root.

### Files to Modify
- `src-tauri/src/commands/filesystem.rs` — add `move_file` command + `MoveFileResult` struct
- `src-tauri/src/commands/mod.rs` — export `move_file`
- `src-tauri/src/models.rs` — add `MoveFileResult` (or keep in filesystem.rs)
- `src-tauri/src/lib.rs` — register `move_file` in `.invoke_handler()`
- `src/lib/services/filesystem.ts` — add `moveFile()` wrapper + `MoveFileResult` type
- `src/lib/components/FileTreeItem.svelte` — add `ondragover`, `ondragleave`, `ondrop` handlers, `onmovefile` prop, `drag-over` CSS class, change `effectAllowed` to `"move"`
- `src/lib/components/FileTree.svelte` — pass `onmovefile` callback through
- `src/lib/components/Sidebar.svelte` — pass `onmovefile` callback, add root drop zone
- `src/App.svelte` — add `handleMoveFile`, pass through component tree

### Tests

**Rust (`filesystem.rs`):**
- `move_file` moves a file to a different directory
- `move_file` returns correct `MoveFileResult` with old and new paths
- `move_file` rejects non-existent source
- `move_file` rejects non-file source (directory)
- `move_file` rejects non-.md files
- `move_file` rejects non-existent target directory
- `move_file` rejects if target already has a file with the same name
- `move_file` rejects paths with `..` (path traversal)

**Frontend (`filesystem.test.ts`):**
- `moveFile()` calls invoke with correct command and args

**FileTreeItem.test.ts:**
- Directory entries accept drag over (prevent default, show `drag-over` class)
- File entries do NOT accept drag over
- Dropping a file on a directory calls `onmovefile` with source path and directory path
- `drag-over` class removed on drag leave
- Dropping a file on itself or same directory does nothing

**FileTree.test.ts:**
- `onmovefile` callback propagates from nested items

**App.svelte (integration):**
- Moving a file updates open pane paths
- Moving a file refreshes the tree
- Failed move doesn't crash (error handled gracefully)

---

## Feature: Create New Folder

### Problem
Users can't create new folders (subdirectories) from within the app. The only way to organize files into folders is to use the OS file manager externally, then let the file watcher pick up the changes. This breaks the workflow — users should be able to create a folder, then immediately create files inside it, all without leaving the app.

### Current State (What Exists)

**New file creation** works via `create_file` Rust command + "+" button in sidebar header. There is no equivalent for directories.

**`Sidebar.svelte` line 119** — the "+" button only triggers `onnewfile` (new file):
```svelte
<button class="new-file-btn" onclick={onnewfile} title="New file">+</button>
```

**No `create_directory` Rust command** exists. The closest pattern is `create_file` in `commands/filesystem.rs` which validates the name and creates a file in a given directory.

### Solution

#### Rust Backend: `create_directory` Command

New Tauri command in `src-tauri/src/commands/filesystem.rs`:

```rust
#[tauri::command]
pub fn create_directory(parent: String, name: String) -> Result<String, String> {
    let name = name.trim().to_string();

    if name.is_empty() {
        return Err("Folder name cannot be empty".into());
    }

    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("Folder name cannot contain path separators".into());
    }

    let parent_dir = Path::new(&parent);
    if !parent_dir.exists() || !parent_dir.is_dir() {
        return Err(format!("Parent directory does not exist: {}", parent));
    }

    let new_dir = parent_dir.join(&name);
    if new_dir.exists() {
        return Err(format!("'{}' already exists", name));
    }

    fs::create_dir(&new_dir)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(new_dir.to_string_lossy().to_string())
}
```

Register in `src-tauri/src/commands/mod.rs` and add to `.invoke_handler()` in `lib.rs`.

#### Frontend Service: `createDirectory()` wrapper

```typescript
// src/lib/services/filesystem.ts
export async function createDirectory(parent: string, name: string): Promise<string> {
  return invoke<string>("create_directory", { parent, name });
}
```

#### Sidebar UI: Folder creation button + inline input

Add a new "📁+" button next to the existing "+" (new file) button in the sidebar header:

```svelte
<!-- Sidebar.svelte -->
<header class="sidebar-header">
  <div class="header-actions">
    {#if onnewfile}
      <button class="new-file-btn" onclick={onnewfile} title="New file">+</button>
    {/if}
    {#if onnewfolder}
      <button class="new-folder-btn" onclick={onnewfolder} title="New folder">📁+</button>
    {/if}
    <!-- ... existing sort, help, folder selector buttons -->
  </div>
</header>
```

When clicked, show an inline input (same pattern as new file creation) but with a folder icon hint:

```svelte
{#if creatingFolder}
  <div class="new-file-input">
    <div class="new-file-row">
      <span class="folder-icon-hint">📁</span>
      <input
        type="text"
        bind:value={newFolderName}
        onkeydown={handleNewFolderKeyDown}
        class="filter-input"
        placeholder="folder name"
        data-testid="new-folder-input"
        use:autofocusSelect
      />
      <button class="create-file-btn" onclick={() => oncreatenewfolder?.(newFolderName)} title="Create folder">✓</button>
    </div>
    {#if newFolderError}
      <p class="new-file-error" role="alert">{newFolderError}</p>
    {/if}
  </div>
{/if}
```

#### App.svelte: Orchestration

```typescript
let creatingFolder = $state(false);
let newFolderError = $state("");

function handleNewFolder() {
  creatingFolder = true;
  newFolderError = "";
}

function handleCancelCreateFolder() {
  creatingFolder = false;
  newFolderError = "";
}

async function handleCreateNewFolder(name: string) {
  // Determine target: selectedFolderPath > focusedTreePath > docsPath
  let targetDir = docsPath;
  if (selectedFolderPath) {
    targetDir = selectedFolderPath;
  } else if (focusedTreePath) {
    const entry = findEntryByPath(rawTree, focusedTreePath);
    if (entry?.is_directory) {
      targetDir = focusedTreePath;
    }
  }

  try {
    const newPath = await createDirectory(targetDir, name);
    creatingFolder = false;
    newFolderError = "";
    // Expand the parent so the new folder is visible
    // Select the new folder so it's highlighted
    selectedFolderPath = newPath;
    await loadTree();
  } catch (e: any) {
    newFolderError = typeof e === "string" ? e : e?.message || String(e);
  }
}
```

#### Target directory logic
Uses the same priority as new file creation:
1. `selectedFolderPath` (mouse-clicked folder) — highest priority
2. `focusedTreePath` if it's a directory (keyboard-navigated folder)
3. `docsPath` (root) — fallback

This means the **Folder Selection** feature (above) should be implemented first, so the user can click a folder then click "📁+" to create a subfolder inside it.

### Files to Modify
- `src-tauri/src/commands/filesystem.rs` — add `create_directory` command
- `src-tauri/src/commands/mod.rs` — export `create_directory`
- `src-tauri/src/lib.rs` — register `create_directory` in `.invoke_handler()`
- `src/lib/services/filesystem.ts` — add `createDirectory()` wrapper
- `src/lib/components/Sidebar.svelte` — add "📁+" button, folder creation inline input, `onnewfolder`/`oncreatenewfolder`/`oncancelcreatefolder`/`creatingFolder`/`newFolderError` props
- `src/App.svelte` — add `creatingFolder`/`newFolderError` state, `handleNewFolder`/`handleCancelCreateFolder`/`handleCreateNewFolder` handlers, pass props to Sidebar

### Tests

**Rust (`filesystem.rs`):**
- `create_directory` creates a new folder in the specified parent
- `create_directory` returns the full path of the new folder
- `create_directory` rejects empty name
- `create_directory` rejects name with path separators
- `create_directory` rejects name with `..`
- `create_directory` rejects if parent doesn't exist
- `create_directory` rejects if folder already exists
- `create_directory` trims whitespace from name

**Frontend (`filesystem.test.ts`):**
- `createDirectory()` calls invoke with correct command and args

**Sidebar.test.ts:**
- "📁+" button visible when `onnewfolder` is provided
- Clicking "📁+" calls `onnewfolder`
- Folder creation input shown when `creatingFolder` is true
- Enter key in folder input calls `oncreatenewfolder` with the typed name
- Escape key in folder input calls `oncancelcreatefolder`
- Folder creation error shown when `newFolderError` is set

**App.svelte (integration):**
- Creating a folder in root creates it in `docsPath`
- Creating a folder with `selectedFolderPath` set creates it inside the selected folder
- New folder appears in tree after creation
- New folder is auto-selected after creation
- Duplicate folder name shows error

---

## Feature: Mermaid Validation, Linting & Auto-Fix

### Problem
Mermaid diagram blocks in markdown files often have syntax errors — wrong keywords, missing arrows, unclosed brackets, bad indentation. Currently the app silently fails: `mermaid.run()` catches the error and the diagram just doesn't render. The user sees a blank space (or raw text) with no indication of what's wrong. This is especially painful when AI tools like Claude Code generate mermaid blocks that have subtle syntax issues.

### How Mermaid Rendering Works Today

In `src/lib/services/markdown.ts`:
1. The `marked` renderer detects `` ```mermaid `` blocks and outputs `<pre class="mermaid">...</pre>`
2. After DOM update, `mermaid.run({ querySelector: "pre.mermaid" })` attempts to render all blocks
3. If a block has invalid syntax, `mermaid.run()` throws silently — the block stays as raw text or goes blank
4. No error feedback to the user at all

### Solution: Three Layers

#### Layer 1: Validation with Error Display (Viewer)

Show clear inline error messages when a mermaid block fails to parse, so users know what's wrong even in view-only mode.

**How it works:** Mermaid.js has a `mermaid.parse(text)` function that validates syntax without rendering. It throws an error with a message and (sometimes) a line number. Use this to pre-validate each block before rendering.

**Implementation:**

Update `src/lib/services/markdown.ts` with a validation wrapper:

```typescript
export interface MermaidDiagnostic {
  blockIndex: number;
  error: string;
  line?: number;
}

export async function validateMermaidBlocks(container: HTMLElement): Promise<MermaidDiagnostic[]> {
  const blocks = container.querySelectorAll("pre.mermaid");
  const diagnostics: MermaidDiagnostic[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].textContent ?? "";
    try {
      await mermaid.parse(text);
    } catch (e: any) {
      diagnostics.push({
        blockIndex: i,
        error: e.message || "Invalid mermaid syntax",
        line: e.hash?.line,
      });
    }
  }
  return diagnostics;
}
```

Update `MarkdownViewer.svelte` to call `validateMermaidBlocks()` after rendering and display error overlays on broken blocks:

```svelte
{#each diagnostics as diag}
  <!-- Overlay on the broken mermaid block -->
  <div class="mermaid-error">
    ⚠️ Diagram error: {diag.error}
  </div>
{/each}
```

Style the error as a visible banner inside the `<pre class="mermaid">` block — red/orange border, error message text, so it's obvious what's wrong instead of a silent blank.

#### Layer 2: Live Linting in Editor (CodeMirror Integration)

When the editor feature is built, integrate mermaid validation into CodeMirror's linting framework. Errors show as red squiggly underlines inside mermaid code blocks while typing.

**How it works:** CodeMirror 6 has a `@codemirror/lint` package. Create a custom linter that:
1. Detects mermaid fenced code blocks in the document
2. Extracts the text of each block
3. Runs `mermaid.parse()` on each
4. Returns diagnostics with positions mapped to editor coordinates

**Install:**
```bash
npm install @codemirror/lint
```

**Implementation:**

New file `src/lib/services/mermaid-linter.ts`:

```typescript
import { linter, type Diagnostic } from "@codemirror/lint";
import mermaid from "mermaid";

// Regex to find ```mermaid ... ``` blocks and their positions
const MERMAID_BLOCK_RE = /```mermaid\n([\s\S]*?)```/g;

export const mermaidLinter = linter(async (view) => {
  const doc = view.state.doc.toString();
  const diagnostics: Diagnostic[] = [];
  let match;

  while ((match = MERMAID_BLOCK_RE.exec(doc)) !== null) {
    const blockContent = match[1];
    const blockStart = match.index + "```mermaid\n".length;

    try {
      await mermaid.parse(blockContent);
    } catch (e: any) {
      diagnostics.push({
        from: blockStart,
        to: blockStart + blockContent.length,
        severity: "error",
        message: e.message || "Invalid mermaid syntax",
      });
    }
  }

  return diagnostics;
});
```

Add this linter to the CodeMirror extensions in `MarkdownEditor.svelte`:
```typescript
import { mermaidLinter } from "../services/mermaid-linter";

// In extensions array:
extensions: [
  basicSetup,
  markdown(),
  oneDark,
  mermaidLinter,  // <-- add this
  // ...
]
```

This gives real-time red underlines on broken mermaid blocks as you type.

#### Layer 3: Auto-Fix Common Errors

An auto-fix system that can detect and repair common mermaid syntax mistakes. This is critical for AI-generated content (Claude Code, etc.) where diagrams are often close-but-not-quite valid.

**Common fixable patterns:**

| Problem | Example | Fix |
|---------|---------|-----|
| Missing diagram type | `A --> B` (no `graph` keyword) | Prepend `graph TD\n` |
| Wrong arrow syntax | `A -> B` (single dash) | Replace with `A --> B` |
| Spaces in node IDs | `My Node --> Other Node` | Wrap in quotes: `"My Node" --> "Other Node"` |
| Missing direction | `graph\n  A --> B` | Default to `graph TD` |
| Unclosed subgraph | `subgraph X\n  A --> B` | Append `end` |
| Semicolons instead of newlines | `A --> B; B --> C` | Replace `;` with `\n` |
| Flowchart instead of graph | `flowchart LR` (old syntax) | Replace with `graph LR` |
| Stray backticks | Extra backticks inside block | Remove them |

**Implementation:**

New file `src/lib/services/mermaid-fixer.ts`:

```typescript
export interface FixResult {
  fixed: string;
  changes: string[];  // Human-readable list of what was fixed
}

export function fixMermaidBlock(text: string): FixResult {
  const changes: string[] = [];
  let fixed = text.trim();

  // Fix: missing diagram type declaration
  if (!fixed.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap|timeline|quadrantChart|xychart|block)/)) {
    if (fixed.includes("-->") || fixed.includes("---")) {
      fixed = "graph TD\n" + fixed;
      changes.push("Added missing 'graph TD' declaration");
    }
  }

  // Fix: flowchart → graph (mermaid supports both but graph is more reliable)
  // Actually, flowchart is valid modern mermaid. Skip this fix.

  // Fix: single-dash arrows
  fixed = fixed.replace(/(\w+)\s*->\s*(\w+)/g, (_, a, b) => {
    changes.push(`Fixed arrow syntax: ${a} -> ${b} → ${a} --> ${b}`);
    return `${a} --> ${b}`;
  });

  // Fix: unclosed subgraphs
  const subgraphCount = (fixed.match(/\bsubgraph\b/g) || []).length;
  const endCount = (fixed.match(/\bend\b/g) || []).length;
  if (subgraphCount > endCount) {
    const missing = subgraphCount - endCount;
    for (let i = 0; i < missing; i++) {
      fixed += "\nend";
    }
    changes.push(`Added ${missing} missing 'end' statement(s) for subgraph(s)`);
  }

  return { fixed, changes };
}

export async function fixMermaidInMarkdown(markdown: string): Promise<{ result: string; totalFixes: number }> {
  // Find all ```mermaid blocks, run fixMermaidBlock on each, reassemble
  let totalFixes = 0;
  const result = markdown.replace(/```mermaid\n([\s\S]*?)```/g, (fullMatch, blockContent) => {
    const { fixed, changes } = fixMermaidBlock(blockContent);
    totalFixes += changes.length;
    return "```mermaid\n" + fixed + "\n```";
  });
  return { result, totalFixes };
}
```

**UI integration (in editor):**

Add a "Fix Diagrams" button in the editor toolbar or as a CodeMirror keybinding (`Ctrl+Shift+F`):
- Runs `fixMermaidInMarkdown()` on the current document
- Shows a toast/notification: "Fixed 3 issues in 2 mermaid blocks"
- Updates the editor content with the fixed version
- Preview immediately re-renders with working diagrams

**UI integration (in viewer):**

When a mermaid block fails validation, show an error banner with a "Try Auto-Fix" button:
```
┌──────────────────────────────────────────────────────┐
│ ⚠️ Diagram error: Lexical error on line 2            │
│                                                       │
│ [Try Auto-Fix]  [Show Raw]                            │
└──────────────────────────────────────────────────────┘
```

Clicking "Try Auto-Fix" runs the fixer on that block, writes the fixed content back to the file, and the watcher triggers a re-render.

### Validation Status Indicator

Add a status indicator in the viewer header showing mermaid health for the current document:

```
nextsteps.md                    ✅ 3 diagrams OK
nextsteps.md                    ⚠️ 1 of 3 diagrams has errors
```

This gives at-a-glance feedback without scrolling through the whole doc.

### Future: CLI / MCP Tool for Validation

For use by AI tools and CI pipelines, expose the validation and fixing as a standalone capability:

**Option A: npm script**
```bash
npm run lint:mermaid -- docs/
```
Walks all `.md` files, validates all mermaid blocks, prints errors, returns non-zero exit code if any fail. Could also auto-fix with a `--fix` flag.

**Option B: MCP Server tool** (see MCP section below)
Expose `validate_mermaid` and `fix_mermaid` as MCP tools so Claude Code can validate diagrams before writing them to disk.

### Tests to Write (TDD)

**mermaid-validation.test.ts** (new file, ~5 tests):
- `validateMermaidBlocks` returns empty array for valid diagrams
- `validateMermaidBlocks` returns diagnostics for invalid syntax
- `validateMermaidBlocks` includes error message from mermaid
- `validateMermaidBlocks` handles multiple blocks (some valid, some not)
- `validateMermaidBlocks` handles empty blocks gracefully

**mermaid-fixer.test.ts** (new file, ~8 tests):
- `fixMermaidBlock` adds missing graph declaration
- `fixMermaidBlock` fixes single-dash arrows to double-dash
- `fixMermaidBlock` closes unclosed subgraphs
- `fixMermaidBlock` returns empty changes array for valid blocks
- `fixMermaidBlock` handles multiple fixes in one block
- `fixMermaidInMarkdown` fixes mermaid blocks within full markdown text
- `fixMermaidInMarkdown` leaves non-mermaid code blocks untouched
- `fixMermaidInMarkdown` reports total fix count

**mermaid-linter.test.ts** (new file, ~3 tests):
- Linter returns no diagnostics for valid mermaid
- Linter returns error diagnostic with correct position for invalid mermaid
- Linter handles document with no mermaid blocks

**MarkdownViewer.test.ts** (2 new tests):
- Shows error overlay when mermaid block is invalid
- Shows validation status indicator (count of OK vs broken diagrams)

---

## Future: MCP Server for Claude Code Integration

### Vision
Expose Polar Markdown's capabilities as an MCP (Model Context Protocol) server so AI tools like Claude Code can read, write, validate, and search markdown docs programmatically. This turns Polar Markdown from a standalone viewer into an AI-accessible knowledge base.

### Why MCP
Claude Code already supports MCP servers. An MCP server would let Claude Code:
- Read the file tree and document contents directly
- Write and update markdown files
- Validate mermaid diagrams before committing them
- Search across all docs for context
- All through a standardized protocol, no custom integration needed

### MCP Tools to Expose

| Tool | Description | Maps To |
|------|-------------|---------|
| `list_documents` | List all markdown files in the current folder | `read_directory_tree` Rust command |
| `read_document` | Read a specific markdown file's contents | `read_file_contents` Rust command |
| `write_document` | Write/update a markdown file | `write_file_contents` Rust command (from editor feature) |
| `search_documents` | Full-text search across all docs | `search_files` Rust command (from search feature) |
| `validate_mermaid` | Validate all mermaid blocks in a document | `mermaid.parse()` via the validation service |
| `fix_mermaid` | Auto-fix common mermaid errors in a document | `fixMermaidInMarkdown()` from the fixer service |
| `get_document_outline` | Return heading structure of a document | Parse headings from markdown |

### Architecture Options

#### Option A: Standalone MCP Server (Node.js process)

A separate Node.js process that implements the MCP protocol and talks to Polar Markdown's backend via Tauri IPC or directly to the filesystem.

```
Claude Code  ←→  MCP Server (Node.js)  ←→  Filesystem (docs/)
                                        ←→  Mermaid validation (in-process)
```

**Pros:** Independent of the Tauri app, can run headless, simpler to develop
**Cons:** Duplicates filesystem logic, doesn't benefit from the running app's watcher state

#### Option B: MCP Server Embedded in Tauri App

The Tauri app itself hosts an MCP-compatible endpoint (local HTTP or stdio).

```
Claude Code  ←→  Tauri App (MCP endpoint)  ←→  Rust backend (existing commands)
                                             ←→  Frontend (mermaid validation)
```

**Pros:** Reuses all existing commands, single source of truth, live sync with the UI
**Cons:** App must be running, more complex Tauri integration

#### Recommendation

Start with **Option A** — a standalone Node.js MCP server. It's faster to build, doesn't require the Tauri app to be running, and can share the mermaid validation/fixing code from `src/lib/services/`. It can read/write directly to the docs folder.

Later, Option B could be added for tighter integration (e.g., the MCP server tells the app to navigate to a specific file after writing it).

### Implementation Plan

**1. Create MCP Server package**

New directory `mcp-server/` at project root with its own `package.json`:
```
mcp-server/
  package.json
  src/
    index.ts          # MCP server entry point
    tools.ts          # Tool definitions
    filesystem.ts     # Direct filesystem operations (read/write/search)
    mermaid.ts        # Import validation/fixing from main app's services
```

**2. Use the official MCP SDK**
```bash
npm install @modelcontextprotocol/sdk
```

**3. Tool Implementation**

Each tool maps to a function. Example for `validate_mermaid`:
```typescript
server.tool("validate_mermaid", { path: z.string() }, async ({ path }) => {
  const content = await fs.readFile(path, "utf-8");
  const blocks = extractMermaidBlocks(content);
  const results = [];
  for (const block of blocks) {
    try {
      await mermaid.parse(block.text);
      results.push({ line: block.line, status: "ok" });
    } catch (e) {
      results.push({ line: block.line, status: "error", message: e.message });
    }
  }
  return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
});
```

**4. Claude Code Configuration**

Users add the server to their Claude Code MCP config:
```json
{
  "mcpServers": {
    "polar-markdown": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js", "--docs-path", "./docs"]
    }
  }
}
```

### Tests to Write (TDD)

**mcp-server/src/tools.test.ts** (new file, ~6 tests):
- `list_documents` returns markdown file paths
- `read_document` returns file content
- `write_document` creates/updates a file
- `validate_mermaid` returns diagnostics for invalid blocks
- `fix_mermaid` returns fixed content and change count
- `search_documents` returns matching files and lines

---

## Feature: Search Result Line Highlighting

### Status: DONE

### Problem
When clicking a search result in full-text search, the file opens but the user has to manually find the matching line. There's no visual indication of where the match is.

### Solution
When a search result line is clicked, open the file AND scroll to + highlight the matching line in the rendered markdown. The highlight should be a temporary visual indicator (e.g. a yellow/amber flash that fades out) so it draws attention without being permanent.

### Implementation Plan

**1. Extend `onselect` to pass line content**
- `SearchResults.onselect` changes from `(path: string)` to `(path: string, lineContent?: string)`
- Individual result lines pass the `match.line_content` when clicked
- File name buttons still pass just the path (no highlight)

**2. Thread highlight through the component chain**
- `Sidebar` → `App.handleSelect` receives the line content
- `App` stores `highlightText` state, passes to `ContentArea` → `MarkdownViewer`
- `MarkdownViewer` receives `highlightText` prop

**3. Highlight logic in MarkdownViewer**
- After markdown renders, if `highlightText` is set:
  - Walk DOM text nodes in `.markdown-body` looking for matching text
  - Wrap matching text in a `<mark class="search-highlight">` element
  - Scroll the mark into view
  - Fade highlight out after ~2 seconds via CSS animation

**4. Clear highlight on navigation**
- When opening a different file or clearing search, reset `highlightText`

### Tests
- SearchResults: clicking a result line passes line content to onselect
- MarkdownViewer: highlight prop triggers scroll/highlight behavior

---

## Feature: Line Numbers Toggle

### Status: PENDING (lower priority)

### Problem
Users may want to see line numbers in the rendered markdown for reference — useful when discussing documents or correlating with search results.

### Solution
Add a toggle button in the viewer header (next to the layout controls) that overlays line numbers on the rendered content. When enabled, each block-level element (paragraph, heading, list item, code block) shows a line number gutter.

### Implementation Plan

**1. Track source line numbers in rendered HTML**
- Extend the `marked` renderer to add `data-source-line` attributes to block-level elements
- The attribute value is the 1-based line number in the original markdown source

**2. Line number toggle UI**
- Add a button (e.g. `#` or `1:`) to the layout controls area in MarkdownViewer header
- Persist the toggle state via localStorage (`persistence.ts`)

**3. CSS line number gutter**
- When enabled, block-level elements with `data-source-line` get a `::before` pseudo-element showing the line number
- Use a left margin/padding to accommodate the gutter

**4. Tests**
- MarkdownViewer: toggle button renders, clicking toggles line numbers
- persistence.test.ts: save/restore line number toggle state

---

## Suggested Implementation Order

These features build on each other. Recommended sequence:

1. ~~**Folder Selector**~~ — DONE
2. ~~**Auto-Select First File on Folder Open**~~ — DONE
3. ~~**Sort Controls**~~ — DONE
4. ~~**Search & Filter Phase 1**~~ (filename) — DONE
5. ~~**Widescreen Layout**~~ — DONE
6. ~~**Multi-File Viewing**~~ — DONE
7. ~~**Search & Filter Phase 2**~~ (full-text) — DONE
8. ~~**ASCII Art Diagram Rendering**~~ (svgbob) — DONE
9. ~~**Search Result Line Highlighting**~~ — DONE
10. ~~**Markdown & Diagram Editor**~~ — DONE (v0.4.0: split-pane CodeMirror + live preview, auto-save, scroll sync, active line highlight, table cell targeting)
11. ~~**New File**~~ — DONE (Ctrl+N, + button, inline input, auto .md, title template, opens in edit mode)
12. ~~**Rename File**~~ — DONE (F2, right-click context menu, inline input, auto .md, updates open panes)
13. ~~**Open Files from OS & CLI**~~ — DONE (file associations, `polarmd file.md` CLI, single-instance, NSIS PATH registration)
14. ~~**Delete File**~~ — DONE (Delete key, right-click menu, native confirm dialog, closes affected panes)
15. ~~**Save As**~~ — DONE (Ctrl+Shift+S, native save dialog, pane updates to new file)
16. **Folder Selection & Targeted File Creation** — `selectedFolderPath` state, visual folder highlight, folder icon (📁), click folder → "+" creates file there
17. **Create New Folder** — Rust `create_directory` command, "📁+" button in sidebar, inline input, auto-selects new folder. Depends on Folder Selection for target directory logic.
18. **Drag-and-Drop File Moving** — Rust `move_file` command, drop handlers on directories, visual drag-over feedback
19. **Mermaid Validation & Error Display** — viewer-side only, no editor dependency
20. **Line Numbers Toggle** — nice-to-have viewer enhancement
21. **Mermaid Linting in Editor** — depends on editor being built (CodeMirror lint integration)
22. **Mermaid Auto-Fix** — depends on validation layer, enhances both viewer and editor
23. **MCP Server** — depends on write command + validation + search being built first

Each feature is independently shippable and testable. Build, test, and verify after each one.

---

## Self-Documenting Requirement

**`docs/How to Use Polar Markdown.md`** is the in-app user guide. A help button (?) in the sidebar header loads this file in the viewer regardless of what folder is currently open.

**Rule:** Every time a new feature ships, update `How to Use Polar Markdown.md` to document it. This keeps the app self-documenting — users can always click the help button to see up-to-date instructions rendered inside Polar Markdown itself.

---

## Other Ideas for Future Iterations

- **Split pane resizing** — draggable dividers between panes
- **Dark/light theme toggle** — currently dark only (Tokyo Night palette)
- **Export to PDF** — print/export the rendered markdown
- **Table of contents** — auto-generated from headings, shown in sidebar or as a floating panel
- **Markdown toolbar** — bold, italic, heading, link, image buttons above editor for quick formatting
- **Vim/Emacs keybindings** — CodeMirror 6 has extensions for these
- **CLI linting script** — `npm run lint:mermaid -- docs/` for CI pipelines, validates all mermaid in all markdown files
- **Image paste/drop** — paste images from clipboard or drag into editor, auto-save to disk
- **Markdown templates** — new file creation offers template choices (meeting notes, project plan, etc.)
- **Word count / reading time** — status bar showing word count and estimated reading time
