<script module lang="ts">
  // Shared across all FileTreeItem instances — stores the path being dragged.
  // Avoids relying on DataTransfer.getData() which returns empty in WebView2.
  export let dragSourcePath: string | null = null;

  /** Reset drag state from outside the component (e.g. global dragend/Escape handlers). */
  export function resetDragSource() { dragSourcePath = null; }
</script>

<script lang="ts">
  import type { FileEntry } from "../types";
  import FileTreeItem from "./FileTreeItem.svelte";

  let {
    entry,
    depth = 0,
    selectedPath = "",
    focusedPath = "",
    selectedFolderPath = "",
    onselect,
    ontoggle,
    onfolderselect,
    onmovefile,
    expandedPaths = new Set<string>(),
    renamingPath = "",
    renameError = "",
    onconfirmrename,
    oncancelrename,
    oncontextmenu,
  }: {
    entry: FileEntry;
    depth?: number;
    selectedPath?: string;
    focusedPath?: string;
    selectedFolderPath?: string;
    onselect: (path: string, event?: MouseEvent) => void;
    ontoggle: (path: string) => void;
    onfolderselect?: (path: string) => void;
    onmovefile?: (sourcePath: string, targetDir: string) => void;
    expandedPaths?: Set<string>;
    renamingPath?: string;
    renameError?: string;
    onconfirmrename?: (oldPath: string, newName: string) => void;
    oncancelrename?: () => void;
    oncontextmenu?: (path: string, x: number, y: number, isDirectory: boolean) => void;
  } = $props();

  const expanded = $derived(expandedPaths.has(entry.path));
  const isRenaming = $derived(!entry.is_directory && entry.path === renamingPath);

  let renameValue = $state("");

  // Reset rename value when entering rename mode
  $effect(() => {
    if (isRenaming) {
      renameValue = entry.name;
    }
  });

  function autofocusSelect(node: HTMLInputElement) {
    node.focus();
    const dot = node.value.lastIndexOf('.');
    node.setSelectionRange(0, dot >= 0 ? dot : node.value.length);
  }

  function handleClick(event: MouseEvent) {
    if (entry.is_directory) {
      ontoggle(entry.path);
      onfolderselect?.(entry.path);
    } else {
      onselect(entry.path, event);
    }
  }

  let dragOver = $state(false);

  function handleDragStart(event: DragEvent) {
    if (!event.dataTransfer) return;
    dragSourcePath = entry.path;
    event.dataTransfer.setData("text/plain", entry.path);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!entry.is_directory) return;
    event.dataTransfer!.dropEffect = "move";
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDragEnd() {
    dragSourcePath = null;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragOver = false;
    if (!entry.is_directory) return;
    // Use module-level variable (WebView2 DataTransfer.getData() returns empty)
    const sourcePath = dragSourcePath ?? event.dataTransfer?.getData("text/plain");
    dragSourcePath = null;
    if (!sourcePath || sourcePath === entry.path) return;
    // Prevent dropping a folder into its own descendant
    const sep = entry.path.includes("\\") ? "\\" : "/";
    if (entry.path.startsWith(sourcePath + sep)) return;
    onmovefile?.(sourcePath, entry.path);
  }

  function handleRenameKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onconfirmrename?.(entry.path, renameValue);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      oncancelrename?.();
    }
  }

  function handleRenameInputClick(event: MouseEvent) {
    event.stopPropagation();
  }

  function handleContextMenu(event: MouseEvent) {
    if (oncontextmenu) {
      event.preventDefault();
      oncontextmenu(entry.path, event.clientX, event.clientY, entry.is_directory);
    }
  }

  const isSelected = $derived(entry.path === selectedPath);
  const isFocused = $derived(entry.path === focusedPath);
  const isFolderSelected = $derived(entry.is_directory && entry.path === selectedFolderPath);
  const paddingLeft = $derived(`${depth * 16 + 8}px`);
</script>

<div class="tree-item">
  {#if isRenaming}
    <div
      class="tree-row rename-row"
      style="padding-left: {paddingLeft}"
      data-path={entry.path}
    >
      <span class="file-icon">📄</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        class="rename-input"
        bind:value={renameValue}
        onkeydown={handleRenameKeyDown}
        onclick={handleRenameInputClick}
        use:autofocusSelect
        data-testid="rename-input"
      />
      <button
        class="rename-confirm-btn"
        onclick={() => onconfirmrename?.(entry.path, renameValue)}
        title="Confirm rename"
      >&#10003;</button>
      <button
        class="rename-cancel-btn"
        onclick={() => oncancelrename?.()}
        title="Cancel rename"
      >&#10005;</button>
    </div>
    {#if renameError}
      <p class="rename-error" role="alert" style="padding-left: {paddingLeft}">{renameError}</p>
    {/if}
  {:else}
    <button
      class="tree-row"
      class:selected={isSelected}
      class:focused={isFocused}
      class:directory={entry.is_directory}
      class:folder-selected={isFolderSelected}
      class:drag-over={dragOver}
      style="padding-left: {paddingLeft}"
      onclick={handleClick}
      oncontextmenu={handleContextMenu}
      draggable={true}
      ondragstart={handleDragStart}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      ondragend={handleDragEnd}
      title={entry.path}
      data-path={entry.path}
    >
      {#if entry.is_directory}
        <span class="chevron">{expanded ? "▼" : "▶"}</span>
        <span class="folder-icon">📁</span>
      {:else}
        <span class="file-icon">📄</span>
      {/if}
      <span class="name">{entry.name}</span>
    </button>
  {/if}

  {#if entry.is_directory && expanded}
    <div class="children">
      {#each entry.children as child (child.path)}
        <FileTreeItem
          entry={child}
          depth={depth + 1}
          {selectedPath}
          {focusedPath}
          {selectedFolderPath}
          {onselect}
          {ontoggle}
          {onfolderselect}
          {onmovefile}
          {expandedPaths}
          {renamingPath}
          {renameError}
          {onconfirmrename}
          {oncancelrename}
          {oncontextmenu}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .tree-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    border: none;
    background: none;
    color: #c0caf5;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    border-radius: 4px;
    font-family: inherit;
  }

  .tree-row:hover {
    background: rgba(122, 162, 247, 0.1);
  }

  .tree-row.selected {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }

  .tree-row.focused {
    outline: 1px solid rgba(122, 162, 247, 0.5);
    background: rgba(122, 162, 247, 0.08);
  }

  .tree-row.directory {
    color: #9ece6a;
  }

  .tree-row.folder-selected {
    background: rgba(158, 206, 106, 0.15);
    outline: 1px solid rgba(158, 206, 106, 0.4);
  }

  .tree-row.drag-over {
    background: rgba(158, 206, 106, 0.25);
    outline: 2px dashed #9ece6a;
    outline-offset: -2px;
  }

  .chevron {
    font-size: 10px;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }

  .file-icon,
  .folder-icon {
    font-size: 12px;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rename-input {
    flex: 1;
    padding: 2px 6px;
    background: #16172b;
    border: 1px solid #7aa2f7;
    border-radius: 3px;
    color: #c0caf5;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    min-width: 0;
  }

  .rename-confirm-btn,
  .rename-cancel-btn {
    background: none;
    border: 1px solid #2f3146;
    border-radius: 3px;
    cursor: pointer;
    padding: 1px 5px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    flex-shrink: 0;
  }

  .rename-confirm-btn {
    color: #9ece6a;
  }

  .rename-confirm-btn:hover {
    background: rgba(158, 206, 106, 0.1);
    border-color: #9ece6a;
  }

  .rename-cancel-btn {
    color: #f7768e;
  }

  .rename-cancel-btn:hover {
    background: rgba(247, 118, 142, 0.1);
    border-color: #f7768e;
  }

  .rename-error {
    margin: 2px 0 0;
    color: #f7768e;
    font-size: 11px;
  }
</style>
