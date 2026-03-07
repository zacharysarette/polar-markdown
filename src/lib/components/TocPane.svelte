<script lang="ts">
  import TableOfContents from "./TableOfContents.svelte";
  import type { TocEntry } from "../types";

  let {
    entries = [] as TocEntry[],
    activeSlug = "",
    onselect,
    onclose,
    fileName = "",
  }: {
    entries?: TocEntry[];
    activeSlug?: string;
    onselect: (slug: string) => void;
    onclose: () => void;
    fileName?: string;
  } = $props();
</script>

<div class="toc-pane">
  <header class="toc-pane-header">
    <span class="toc-pane-title" title={fileName}>
      {fileName ? `TOC: ${fileName}` : "Table of Contents"}
    </span>
    <button
      class="toc-close-btn"
      title="Close TOC (Ctrl+T)"
      onclick={(e) => { e.stopPropagation(); onclose(); }}
    >&times;</button>
  </header>
  <div class="toc-pane-content">
    {#if entries.length > 0}
      <TableOfContents {entries} {activeSlug} {onselect} />
    {:else}
      <p class="toc-empty">No headings found.</p>
    {/if}
  </div>
</div>

<style>
  .toc-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border-right: 1px solid var(--border);
  }

  .toc-pane-header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-secondary);
  }

  .toc-pane-title {
    font-size: 12px;
    color: var(--accent);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toc-close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .toc-close-btn:hover {
    color: var(--red);
    background: var(--red-hover);
  }

  .toc-pane-content {
    flex: 1;
    overflow-y: auto;
  }

  .toc-empty {
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
  }
</style>
