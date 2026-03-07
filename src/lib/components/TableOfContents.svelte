<script lang="ts">
  import type { TocEntry } from "../types";

  let {
    entries = [] as TocEntry[],
    activeSlug = "",
    onselect,
  }: {
    entries?: TocEntry[];
    activeSlug?: string;
    onselect: (slug: string) => void;
  } = $props();
</script>

<nav class="toc" aria-label="Table of contents">
  {#if entries.length > 0}
    <ul>
      {#each entries as entry}
        <li>
          <button
            class="toc-entry"
            class:active={entry.slug === activeSlug}
            style="padding-left: {(entry.depth - 1) * 12}px"
            onclick={() => onselect(entry.slug)}
            title={entry.text}
          >
            {entry.text}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</nav>

<style>
  .toc {
    overflow-y: auto;
    padding: 8px 0;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    margin: 0;
    padding: 0;
  }

  .toc-entry {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: 0;
    line-height: 1.4;
  }

  .toc-entry:hover {
    background: var(--accent-hover);
    color: var(--text);
  }

  .toc-entry.active {
    color: var(--accent);
    background: var(--accent-active);
    font-weight: 500;
  }
</style>
