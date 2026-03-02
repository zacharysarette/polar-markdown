<script lang="ts">
  import type { FileEntry } from "../types";
  import FileTreeItem from "./FileTreeItem.svelte";
  import { flattenVisibleEntries } from "../services/tree-utils";

  let {
    entries,
    selectedPath = "",
    onselect,
    onfocuschange,
  }: {
    entries: FileEntry[];
    selectedPath?: string;
    onselect: (path: string, event?: MouseEvent) => void;
    onfocuschange?: (path: string) => void;
  } = $props();

  let focusedPath = $state("");
  let expandedPaths: Set<string> = $state(new Set());

  // Initialize expanded paths: top-level directories start expanded
  $effect(() => {
    const topDirs = entries
      .filter((e) => e.is_directory)
      .map((e) => e.path);
    expandedPaths = new Set(topDirs);
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
    if (visiblePaths.length === 0) return;

    const currentIndex = focusedPath
      ? visiblePaths.indexOf(focusedPath)
      : -1;

    if (event.key === "ArrowDown") {
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
    />
  {/each}

  {#if entries.length === 0}
    <p class="empty">No markdown files found.</p>
  {/if}
</div>

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
</style>
