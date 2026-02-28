<script lang="ts">
  import type { FileEntry } from "../types";
  import FileTree from "./FileTree.svelte";

  import type { SortMode } from "../services/sort";

  let {
    entries,
    selectedPath = "",
    onselect,
    onchangefolder,
    sortMode = "name-asc" as SortMode,
    onsortchange,
    onhelp,
    filterQuery = "",
    onfilterchange,
  }: {
    entries: FileEntry[];
    selectedPath?: string;
    onselect: (path: string) => void;
    onchangefolder?: () => void;
    sortMode?: SortMode;
    onsortchange?: () => void;
    onhelp?: () => void;
    filterQuery?: string;
    onfilterchange?: (query: string) => void;
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
</script>

<aside class="sidebar" aria-label="File browser">
  <header class="sidebar-header">
    <h2>Files</h2>
    <div class="header-actions">
      {#if onsortchange}
        <button class="sort-btn" onclick={onsortchange} title="Sort files">
          {sortLabels[sortMode]}
        </button>
      {/if}
      {#if onhelp}
        <button class="help-btn" onclick={onhelp} title="Help">?</button>
      {/if}
      {#if onchangefolder}
        <button class="change-folder-btn" onclick={onchangefolder} title="Change folder">
          <span class="folder-icon">📁</span>
        </button>
      {/if}
    </div>
  </header>
  {#if onfilterchange}
    <div class="filter-bar">
      <input
        type="text"
        placeholder="Filter files..."
        value={filterQuery}
        oninput={(e) => onfilterchange(e.currentTarget.value)}
        class="filter-input"
      />
    </div>
  {/if}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <nav class="sidebar-content" onclick={handleNavClick}>
    <FileTree {entries} {selectedPath} {onselect} />
  </nav>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    background: #1e1f2e;
    border-right: 1px solid #2f3146;
    height: 100%;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #2f3146;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sidebar-header h2 {
    font-size: 14px;
    font-weight: 600;
    color: #7aa2f7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .sort-btn {
    background: none;
    border: 1px solid #2f3146;
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 8px;
    font-size: 11px;
    line-height: 1;
    color: #a9b1d6;
    font-weight: 500;
  }

  .sort-btn:hover {
    background: rgba(122, 162, 247, 0.1);
    border-color: #7aa2f7;
    color: #7aa2f7;
  }

  .help-btn {
    background: none;
    border: 1px solid #2f3146;
    border-radius: 50%;
    cursor: pointer;
    width: 22px;
    height: 22px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    color: #a9b1d6;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .help-btn:hover {
    background: rgba(122, 162, 247, 0.1);
    border-color: #7aa2f7;
    color: #7aa2f7;
  }

  .change-folder-btn {
    background: none;
    border: 1px solid #2f3146;
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 14px;
    line-height: 1;
  }

  .change-folder-btn:hover {
    background: rgba(122, 162, 247, 0.1);
    border-color: #7aa2f7;
  }

  .filter-bar {
    padding: 8px 12px;
    border-bottom: 1px solid #2f3146;
    flex-shrink: 0;
  }

  .filter-input {
    width: 100%;
    padding: 6px 10px;
    background: #16172b;
    border: 1px solid #2f3146;
    border-radius: 4px;
    color: #a9b1d6;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }

  .filter-input:focus {
    border-color: #7aa2f7;
  }

  .filter-input::placeholder {
    color: #565f89;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
