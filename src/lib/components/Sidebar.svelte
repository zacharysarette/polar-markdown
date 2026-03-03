<script lang="ts">
  import type { FileEntry, SearchResult, ThemeType } from "../types";
  import FileTree from "./FileTree.svelte";
  import SearchResults from "./SearchResults.svelte";
  import { dragSourcePath, resetDragSource } from "./FileTreeItem.svelte";

  import type { SortMode } from "../services/sort";

  let {
    entries,
    selectedPath = "",
    onselect,
    onchangefolder,
    sortMode = "name-asc" as SortMode,
    onsortchange,
    onhelp,
    helpActive = false,
    filterQuery = "",
    onfilterchange,
    searchMode = false,
    onsearchmodechange,
    searchResults = [] as SearchResult[],
    searchQuery = "",
    onsearchchange,
    isSearching = false,
    onnewfile,
    onnewfolder,
    creatingFile = false,
    creatingFolder = false,
    oncreatenewfile,
    oncancelcreate,
    oncreatenewfolder,
    oncancelcreatefolder,
    newFileError = "",
    newFolderError = "",
    selectedFolderPath = "",
    onfocuschange,
    onfolderselect,
    onmovefile,
    renamingPath = "",
    renameError = "",
    onstartrename,
    onconfirmrename,
    oncancelrename,
    ondelete,
    onsaveas,
    oncopypath,
    docsPath = "",
    theme = "aurora" as ThemeType,
    onthemetoggle,
  }: {
    entries: FileEntry[];
    selectedPath?: string;
    onselect: (path: string, event?: MouseEvent, highlightText?: string) => void;
    onchangefolder?: () => void;
    sortMode?: SortMode;
    onsortchange?: () => void;
    onhelp?: () => void;
    helpActive?: boolean;
    filterQuery?: string;
    onfilterchange?: (query: string) => void;
    searchMode?: boolean;
    onsearchmodechange?: () => void;
    searchResults?: SearchResult[];
    searchQuery?: string;
    onsearchchange?: (query: string) => void;
    isSearching?: boolean;
    onnewfile?: () => void;
    onnewfolder?: () => void;
    creatingFile?: boolean;
    creatingFolder?: boolean;
    oncreatenewfile?: (filename: string) => void;
    oncancelcreate?: () => void;
    oncreatenewfolder?: (name: string) => void;
    oncancelcreatefolder?: () => void;
    newFileError?: string;
    newFolderError?: string;
    selectedFolderPath?: string;
    onfocuschange?: (path: string) => void;
    onfolderselect?: (path: string) => void;
    onmovefile?: (sourcePath: string, targetDir: string) => void;
    renamingPath?: string;
    renameError?: string;
    onstartrename?: (path: string) => void;
    onconfirmrename?: (oldPath: string, newName: string) => void;
    oncancelrename?: () => void;
    ondelete?: (path: string) => void;
    onsaveas?: (path: string) => void;
    oncopypath?: (path: string) => void;
    docsPath?: string;
    theme?: ThemeType;
    onthemetoggle?: () => void;
  } = $props();

  const sortLabels: Record<SortMode, string> = {
    "name-asc": "A-Z",
    "name-desc": "Z-A",
    "modified-desc": "Newest",
    "modified-asc": "Oldest",
  };

  function handleNavClick(event: MouseEvent) {
    const tree = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[role="tree"]');
    tree?.focus();
  }

  let newFilename = $state("untitled.md");
  let newFolderName = $state("new-folder");

  // Reset filename before DOM update so input mounts with correct value
  $effect.pre(() => {
    if (creatingFile) {
      newFilename = "untitled.md";
    }
  });

  $effect.pre(() => {
    if (creatingFolder) {
      newFolderName = "new-folder";
    }
  });

  // Svelte action: synchronously focuses and selects on mount (no async hop)
  function autofocusSelect(node: HTMLInputElement) {
    node.focus();
    const dot = node.value.lastIndexOf('.');
    node.setSelectionRange(0, dot >= 0 ? dot : node.value.length);
  }

  function handleNewFileKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      oncreatenewfile?.(newFilename);
    } else if (event.key === "Escape") {
      event.preventDefault();
      oncancelcreate?.();
    }
  }

  function handleNewFolderKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      oncreatenewfolder?.(newFolderName);
    } else if (event.key === "Escape") {
      event.preventDefault();
      oncancelcreatefolder?.();
    }
  }

  function autofocusSelectAll(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function handleSearchSelect(path: string, lineContent?: string) {
    onselect(path, undefined, lineContent);
  }

  let navDragOver = $state(false);

  function handleNavDragOver(e: DragEvent) {
    e.preventDefault();
    navDragOver = true;
  }

  function handleNavDragLeave(e: DragEvent) {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    navDragOver = false;
  }

  function handleNavDrop(e: DragEvent) {
    e.preventDefault();
    navDragOver = false;
    const sourcePath = dragSourcePath ?? e.dataTransfer?.getData("text/plain");
    resetDragSource();
    if (!sourcePath || !docsPath) return;
    onmovefile?.(sourcePath, docsPath);
  }
</script>

<aside class="sidebar" aria-label="File browser">
  <header class="sidebar-header">
    <div class="header-actions">
      {#if onthemetoggle}
        <button class="theme-toggle-btn" onclick={onthemetoggle} title={theme === "aurora" ? "Switch to Glacier (light)" : "Switch to Aurora (dark)"}>
          {theme === "aurora" ? "☀️" : "🌙"}
        </button>
      {/if}
      {#if onnewfile}
        <button class="new-file-btn" onclick={onnewfile} title="New file">+</button>
      {/if}
      {#if onnewfolder}
        <button class="new-folder-btn" onclick={onnewfolder} title="New folder">🧊+</button>
      {/if}
      {#if onsortchange}
        <button class="sort-btn" onclick={onsortchange} title="Sort files">
          {sortLabels[sortMode]}
        </button>
      {/if}
      {#if onhelp}
        <button class="help-btn" class:help-active={helpActive} onclick={onhelp} title="Help">?</button>
      {/if}
      {#if onchangefolder}
        <button class="change-folder-btn" onclick={onchangefolder} title="Change folder">
          <span class="folder-icon">🧊</span>
        </button>
      {/if}
    </div>
  </header>
  {#if onfilterchange || onsearchchange}
    <div class="filter-bar">
      <div class="filter-row">
        {#if searchMode && onsearchchange}
          <input
            type="text"
            placeholder="Search file contents..."
            value={searchQuery}
            oninput={(e) => onsearchchange(e.currentTarget.value)}
            class="filter-input"
          />
        {:else if onfilterchange}
          <input
            type="text"
            placeholder="Filter files..."
            value={filterQuery}
            oninput={(e) => onfilterchange(e.currentTarget.value)}
            class="filter-input"
          />
        {/if}
        {#if onsearchmodechange}
          <button
            class="search-toggle"
            class:active={searchMode}
            onclick={onsearchmodechange}
            title={searchMode ? "Switch to filename filter" : "Search file contents"}
          >
            🔍
          </button>
        {/if}
      </div>
    </div>
  {/if}
  {#if searchMode && searchQuery}
    <div class="sidebar-content">
      {#if isSearching}
        <p class="searching">Searching...</p>
      {:else}
        <SearchResults results={searchResults} query={searchQuery} onselect={handleSearchSelect} />
      {/if}
    </div>
  {:else}
    {#if creatingFile}
      <div class="new-file-input">
        {#if selectedFolderPath}
          <span class="create-target-hint">in {selectedFolderPath.split(/[\\/]/).pop()}/</span>
        {/if}
        <div class="new-file-row">
          <input
            type="text"
            bind:value={newFilename}
            onkeydown={handleNewFileKeyDown}
            class="filter-input"
            placeholder="filename.md"
            data-testid="new-file-input"
            use:autofocusSelect
          />
          <button
            class="create-file-btn"
            onclick={() => oncreatenewfile?.(newFilename)}
            title="Create file"
          >✓</button>
        </div>
        {#if newFileError}
          <p class="new-file-error" role="alert">{newFileError}</p>
        {/if}
      </div>
    {/if}
    {#if creatingFolder}
      <div class="new-file-input">
        {#if selectedFolderPath}
          <span class="create-target-hint">in {selectedFolderPath.split(/[\\/]/).pop()}/</span>
        {/if}
        <div class="new-file-row">
          <span class="folder-hint-icon">🧊</span>
          <input
            type="text"
            bind:value={newFolderName}
            onkeydown={handleNewFolderKeyDown}
            class="filter-input"
            placeholder="folder name"
            data-testid="new-folder-input"
            use:autofocusSelectAll
          />
          <button
            class="create-file-btn"
            onclick={() => oncreatenewfolder?.(newFolderName)}
            title="Create folder"
          >✓</button>
        </div>
        {#if newFolderError}
          <p class="new-file-error" role="alert">{newFolderError}</p>
        {/if}
      </div>
    {/if}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <nav class="sidebar-content" class:nav-drag-over={navDragOver} onclick={handleNavClick} ondragover={handleNavDragOver} ondragleave={handleNavDragLeave} ondrop={handleNavDrop}>
      <FileTree {entries} {selectedPath} {selectedFolderPath} {onselect} {onfocuschange} {onfolderselect} {onmovefile} {renamingPath} {renameError} {onstartrename} {onconfirmrename} {oncancelrename} {ondelete} {onsaveas} {oncopypath} docsPath={docsPath} />
    </nav>
  {/if}
  {#if docsPath}
    <div class="folder-path" title={docsPath}>
      {docsPath.split(/[\\/]/).pop() ?? docsPath}
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    height: 100%;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .theme-toggle-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 14px;
    line-height: 1;
  }

  .theme-toggle-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent);
  }

  .sort-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 8px;
    font-size: 11px;
    line-height: 1;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .sort-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent);
    color: var(--accent);
  }

  .help-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 50%;
    cursor: pointer;
    width: 22px;
    height: 22px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .help-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent);
    color: var(--accent);
  }

  .help-btn.help-active {
    background: var(--accent-active);
    border-color: var(--accent);
    color: var(--accent);
    box-shadow: 0 0 6px var(--accent-outline);
  }

  .change-folder-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 14px;
    line-height: 1;
  }

  .change-folder-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent);
  }

  .folder-path {
    padding: 8px 16px;
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
    border-top: 1px solid var(--border);
  }

  .filter-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .filter-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .filter-input {
    flex: 1;
    padding: 6px 10px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    min-width: 0;
  }

  .filter-input:focus {
    border-color: var(--accent);
  }

  .filter-input::placeholder {
    color: var(--text-muted);
  }

  .search-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    padding: 4px 6px;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .search-toggle:hover {
    background: var(--accent-hover);
    border-color: var(--accent);
  }

  .search-toggle.active {
    background: var(--accent-active);
    border-color: var(--accent);
  }

  .searching {
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sidebar-content.nav-drag-over {
    border-bottom: 2px solid var(--green);
  }

  .new-file-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 8px;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    color: var(--text-secondary);
  }

  .new-file-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent);
    color: var(--accent);
  }

  .new-folder-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 11px;
    line-height: 1;
    color: var(--text-secondary);
  }

  .new-folder-btn:hover {
    background: var(--green-hover);
    border-color: var(--green);
    color: var(--green);
  }

  .create-target-hint {
    font-size: 11px;
    color: var(--green);
    margin-bottom: 4px;
    display: block;
  }

  .folder-hint-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .new-file-input {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .new-file-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .create-file-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    padding: 4px 8px;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    color: var(--green);
    flex-shrink: 0;
  }

  .create-file-btn:hover {
    background: var(--green-hover);
    border-color: var(--green);
    box-shadow: 0 0 6px var(--green-outline);
  }

  .new-file-error {
    margin: 4px 0 0;
    color: var(--red);
    font-size: 12px;
  }
</style>
