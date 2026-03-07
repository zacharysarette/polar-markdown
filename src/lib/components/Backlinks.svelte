<script lang="ts">
  import type { SearchResult } from "../types";

  let {
    backlinks = [],
    onselect,
  }: {
    backlinks?: SearchResult[];
    onselect?: (path: string) => void;
  } = $props();

  let expanded = $state(false);
</script>

{#if backlinks.length > 0}
  <footer class="backlinks">
    <button class="backlinks-header" onclick={() => expanded = !expanded}>
      <span class="backlinks-arrow" class:expanded>{expanded ? "\u25BC" : "\u25B6"}</span>
      <span class="backlinks-count">{backlinks.length} backlink{backlinks.length === 1 ? "" : "s"}</span>
    </button>
    {#if expanded}
      <ul class="backlinks-list">
        {#each backlinks as bl}
          <li class="backlinks-file">
            <button class="backlinks-file-link" onclick={() => onselect?.(bl.path)}>
              {bl.name}
            </button>
            <ul class="backlinks-matches">
              {#each bl.matches.slice(0, 3) as match}
                <li class="backlinks-match">{match.line_content.trim()}</li>
              {/each}
              {#if bl.matches.length > 3}
                <li class="backlinks-more">+{bl.matches.length - 3} more</li>
              {/if}
            </ul>
          </li>
        {/each}
      </ul>
    {/if}
  </footer>
{/if}

<style>
  .backlinks {
    border-top: 1px solid var(--border);
    padding: 8px 16px;
    flex-shrink: 0;
  }

  .backlinks-header {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 0;
    width: 100%;
    text-align: left;
  }

  .backlinks-header:hover {
    color: var(--accent);
  }

  .backlinks-arrow {
    font-size: 10px;
    transition: transform 0.15s;
  }

  .backlinks-count {
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .backlinks-list {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }

  .backlinks-file {
    margin-bottom: 8px;
  }

  .backlinks-file-link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    padding: 2px 0;
    text-align: left;
  }

  .backlinks-file-link:hover {
    text-decoration: underline;
  }

  .backlinks-matches {
    list-style: none;
    margin: 2px 0 0 12px;
    padding: 0;
  }

  .backlinks-match {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 600px;
    line-height: 1.6;
  }

  .backlinks-more {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
