<script lang="ts">
  import type { FileEntry } from "../types";
  import FileTreeItem from "./FileTreeItem.svelte";
  import { flattenVisibleEntries } from "../services/tree-utils";
  import { saveExpandedPaths, getExpandedPaths } from "../services/persistence";

  let {
    entries,
    selectedPath = "",
    onselect,
    onfocuschange,
    renamingPath = "",
    renameError = "",
    onstartrename,
    onconfirmrename,
    oncancelrename,
    ondelete,
  }: {
    entries: FileEntry[];
    selectedPath?: string;
    onselect: (path: string, event?: MouseEvent) => void;
    onfocuschange?: (path: string) => void;
    renamingPath?: string;
    renameError?: string;
    onstartrename?: (path: string) => void;
    onconfirmrename?: (oldPath: string, newName: string) => void;
    oncancelrename?: () => void;
    ondelete?: (path: string) => void;
  } = $props();

  let focusedPath = $state("");
  let expandedPaths: Set<string> = $state(new Set(getExpandedPaths()));
  let contextMenu: { x: number; y: number; path: string } | null = $state(null);

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
      const entry = findEntryByPath(entries, focusedPath);
      if (entry && !entry.is_directory) {
        ondelete?.(focusedPath);
      }
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

  function handleContextMenu(path: string, x: number, y: number) {
    contextMenu = { x, y, path };
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
  {#each entries as entry (entry.path)}
    <FileTreeItem
      {entry}
      depth={0}
      {selectedPath}
      {focusedPath}
      {onselect}
      ontoggle={handleToggle}
      {expandedPaths}
      {renamingPath}
      {renameError}
      {onconfirmrename}
      {oncancelrename}
      oncontextmenu={handleContextMenu}
    />
  {/each}

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
    <button class="context-menu-item" onclick={handleContextMenuRename}>Rename</button>
    <button class="context-menu-item delete" onclick={handleContextMenuDelete}>Delete</button>
  </div>
{/if}

<style>
  .file-tree {
    padding: 4px 0;
    outline: none;
  }

  .empty {
    padding: 16px;
    color: #565f89;
    font-size: 13px;
    font-style: italic;
  }

  .context-menu {
    position: fixed;
    background: #1e1f2e;
    border: 1px solid #2f3146;
    border-radius: 6px;
    padding: 4px 0;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 1000;
  }

  .context-menu-item {
    display: block;
    width: 100%;
    padding: 6px 16px;
    border: none;
    background: none;
    color: #c0caf5;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .context-menu-item:hover {
    background: rgba(122, 162, 247, 0.15);
    color: #7aa2f7;
  }

  .context-menu-item.delete:hover {
    background: rgba(247, 118, 142, 0.15);
    color: #f7768e;
  }
</style>
