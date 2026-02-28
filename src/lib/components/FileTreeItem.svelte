<script lang="ts">
  import type { FileEntry } from "../types";
  import FileTreeItem from "./FileTreeItem.svelte";

  let {
    entry,
    depth = 0,
    selectedPath = "",
    focusedPath = "",
    onselect,
    ontoggle,
    expandedPaths = new Set<string>(),
  }: {
    entry: FileEntry;
    depth?: number;
    selectedPath?: string;
    focusedPath?: string;
    onselect: (path: string) => void;
    ontoggle: (path: string) => void;
    expandedPaths?: Set<string>;
  } = $props();

  const expanded = $derived(expandedPaths.has(entry.path));

  function handleClick() {
    if (entry.is_directory) {
      ontoggle(entry.path);
    } else {
      onselect(entry.path);
    }
  }

  const isSelected = $derived(entry.path === selectedPath);
  const isFocused = $derived(entry.path === focusedPath);
  const paddingLeft = $derived(`${depth * 16 + 8}px`);
</script>

<div class="tree-item">
  <button
    class="tree-row"
    class:selected={isSelected}
    class:focused={isFocused}
    class:directory={entry.is_directory}
    style="padding-left: {paddingLeft}"
    onclick={handleClick}
    title={entry.path}
    data-path={entry.path}
  >
    {#if entry.is_directory}
      <span class="chevron">{expanded ? "▼" : "▶"}</span>
    {:else}
      <span class="file-icon">📄</span>
    {/if}
    <span class="name">{entry.name}</span>
  </button>

  {#if entry.is_directory && expanded}
    <div class="children">
      {#each entry.children as child (child.path)}
        <FileTreeItem
          entry={child}
          depth={depth + 1}
          {selectedPath}
          {focusedPath}
          {onselect}
          {ontoggle}
          {expandedPaths}
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

  .chevron {
    font-size: 10px;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }

  .file-icon {
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
</style>
