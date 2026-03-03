<script lang="ts">
  import type { FileEntry } from "../types";
  import FileTreeItem, { dragSourcePath, resetDragSource } from "./FileTreeItem.svelte";
  import { flattenVisibleEntries } from "../services/tree-utils";
  import { saveExpandedPaths, getExpandedPaths } from "../services/persistence";

  let {
    entries,
    selectedPath = "",
    selectedFolderPath = "",
    docsPath = "",
    onselect,
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
  }: {
    entries: FileEntry[];
    selectedPath?: string;
    selectedFolderPath?: string;
    docsPath?: string;
    onselect: (path: string, event?: MouseEvent) => void;
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
  } = $props();

  let focusedPath = $state("");
  let expandedPaths: Set<string> = $state(new Set(getExpandedPaths()));
  let contextMenu: { x: number; y: number; path: string; isDirectory: boolean } | null = $state(null);

  // Click-outside dismissal for context menu
  $effect(() => {
    if (!contextMenu) return;
    function handleDocumentClick() {
      contextMenu = null;
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  });

  const visiblePaths = $derived(flattenVisibleEntries(entries, expandedPaths));

  function findEntryByPath(
    items: FileEntry[],
    path: string
  ): FileEntry | undefined {
    for (const item of items) {
      if (item.path === path) return item;
      if (item.is_directory) {
        const found = findEntryByPath(item.children, path);
        if (found) return found;
      }
    }
    return undefined;
  }

  function autoSelectIfFile(path: string) {
    const entry = findEntryByPath(entries, path);
    if (entry && !entry.is_directory) {
      onselect(entry.path);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && contextMenu) {
      event.preventDefault();
      contextMenu = null;
      return;
    }

    if (visiblePaths.length === 0) return;

    const currentIndex = focusedPath
      ? visiblePaths.indexOf(focusedPath)
      : -1;

    if (event.key === "Delete" && focusedPath) {
      event.preventDefault();
      ondelete?.(focusedPath);
    } else if (event.key === "F2" && focusedPath) {
      event.preventDefault();
      const entry = findEntryByPath(entries, focusedPath);
      if (entry && !entry.is_directory) {
        onstartrename?.(focusedPath);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, visiblePaths.length - 1);
      focusedPath = visiblePaths[nextIndex];
      onfocuschange?.(focusedPath);
      autoSelectIfFile(focusedPath);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      focusedPath = visiblePaths[prevIndex];
      onfocuschange?.(focusedPath);
      autoSelectIfFile(focusedPath);
    } else if (event.key === "Enter" && focusedPath) {
      event.preventDefault();
      const entry = findEntryByPath(entries, focusedPath);
      if (entry) {
        if (entry.is_directory) {
          toggleExpanded(focusedPath);
        } else {
          onselect(entry.path);
        }
      }
    }
  }

  function toggleExpanded(path: string) {
    const next = new Set(expandedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    expandedPaths = next;
    saveExpandedPaths([...next]);
  }

  function handleToggle(path: string) {
    toggleExpanded(path);
  }

  function handleFocus() {
    if (focusedPath) return;
    if (selectedPath && visiblePaths.includes(selectedPath)) {
      focusedPath = selectedPath;
    } else if (visiblePaths.length > 0) {
      focusedPath = visiblePaths[0];
    }
  }

  function handleContextMenu(path: string, x: number, y: number, isDirectory: boolean) {
    contextMenu = { x, y, path, isDirectory };
  }

  function handleContextMenuRename() {
    if (contextMenu) {
      onstartrename?.(contextMenu.path);
      contextMenu = null;
    }
  }

  function handleContextMenuDelete() {
    if (contextMenu) {
      ondelete?.(contextMenu.path);
      contextMenu = null;
    }
  }

  function handleContextMenuCopyPath() {
    if (contextMenu) {
      oncopypath?.(contextMenu.path);
      contextMenu = null;
    }
  }

  function handleContextMenuSaveAs() {
    if (contextMenu) {
      onsaveas?.(contextMenu.path);
      contextMenu = null;
    }
  }

  let activeGap: number | null = $state(null);

  function handleGapDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = "move";
    activeGap = index;
  }

  function handleGapDragLeave(e: DragEvent, index: number) {
    e.stopPropagation();
    if (activeGap === index) activeGap = null;
  }

  function handleGapDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    activeGap = null;
    const sourcePath = dragSourcePath ?? e.dataTransfer?.getData("text/plain");
    resetDragSource();
    if (!sourcePath || !docsPath) return;
    // Don't move if already at root level
    const sep = sourcePath.includes("\\") ? "\\" : "/";
    const parentDir = sourcePath.substring(0, sourcePath.lastIndexOf(sep));
    if (parentDir === docsPath) return;
    onmovefile?.(sourcePath, docsPath);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="file-tree"
  role="tree"
  aria-label="File tree"
  tabindex="0"
  onkeydown={handleKeyDown}
  onfocus={handleFocus}
>
  {#each entries as entry, i (entry.path)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="root-drop-gap"
      class:active={activeGap === i}
      ondragover={(e) => handleGapDragOver(e, i)}
      ondragleave={(e) => handleGapDragLeave(e, i)}
      ondrop={(e) => handleGapDrop(e)}
    ></div>
    <FileTreeItem
      {entry}
      depth={0}
      {selectedPath}
      {focusedPath}
      {selectedFolderPath}
      {onselect}
      ontoggle={handleToggle}
      {onfolderselect}
      {onmovefile}
      {expandedPaths}
      {renamingPath}
      {renameError}
      {onconfirmrename}
      {oncancelrename}
      oncontextmenu={handleContextMenu}
    />
  {/each}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="root-drop-gap"
    class:active={activeGap === entries.length}
    ondragover={(e) => handleGapDragOver(e, entries.length)}
    ondragleave={(e) => handleGapDragLeave(e, entries.length)}
    ondrop={(e) => handleGapDrop(e)}
  ></div>

  {#if entries.length === 0}
    <p class="empty">No markdown files found.</p>
  {/if}
</div>

{#if contextMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="context-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    onclick={(e) => e.stopPropagation()}
  >
    <button class="context-menu-item" onclick={handleContextMenuCopyPath}>Copy Path</button>
    {#if !contextMenu.isDirectory}
      <button class="context-menu-item" onclick={handleContextMenuSaveAs}>Save As</button>
      <button class="context-menu-item" onclick={handleContextMenuRename}>Rename</button>
    {/if}
    <button class="context-menu-item delete" onclick={handleContextMenuDelete}>Delete</button>
  </div>
{/if}

<style>
  .file-tree {
    padding: 4px 0;
    outline: none;
  }

  .root-drop-gap {
    height: 4px;
    position: relative;
    flex-shrink: 0;
  }

  .root-drop-gap.active {
    height: 8px;
  }

  .root-drop-gap.active::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    top: 50%;
    height: 2px;
    background: var(--green);
    border-radius: 1px;
    transform: translateY(-50%);
  }

  .empty {
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
  }

  .context-menu {
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 0;
    min-width: 120px;
    box-shadow: 0 4px 12px var(--shadow);
    z-index: 1000;
  }

  .context-menu-item {
    display: block;
    width: 100%;
    padding: 6px 16px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .context-menu-item:hover {
    background: var(--accent-bg);
    color: var(--accent);
  }

  .context-menu-item.delete:hover {
    background: var(--red-bg);
    color: var(--red);
  }
</style>
