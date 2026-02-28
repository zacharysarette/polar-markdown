<script lang="ts">
  import type { SearchResult } from "../types";

  let {
    results,
    query = "",
    onselect,
  }: {
    results: SearchResult[];
    query?: string;
    onselect: (path: string, lineContent?: string) => void;
  } = $props();
</script>

<div class="search-results">
  {#if results.length === 0}
    <p class="no-results">No results for "{query}"</p>
  {:else}
    {#each results as result (result.path)}
      <div class="result-group">
        <button class="result-file" onclick={() => onselect(result.path, undefined)}>
          <span class="result-name">{result.name}</span>
          <span class="match-count">
            {result.matches.length} {result.matches.length === 1 ? "match" : "matches"}
          </span>
        </button>
        <div class="result-lines">
          {#each result.matches as match}
            <button class="result-line" onclick={() => onselect(result.path, match.line_content)}>
              <span class="line-number">{match.line_number}:</span>
              <span class="line-content">{match.line_content}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .search-results {
    padding: 4px 0;
  }

  .no-results {
    padding: 16px;
    color: #565f89;
    font-size: 13px;
    font-style: italic;
  }

  .result-group {
    margin-bottom: 4px;
  }

  .result-file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: none;
    color: #7aa2f7;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  .result-file:hover {
    background: rgba(122, 162, 247, 0.1);
  }

  .match-count {
    font-size: 11px;
    font-weight: 400;
    color: #565f89;
    flex-shrink: 0;
  }

  .result-lines {
    padding-left: 12px;
  }

  .result-line {
    display: flex;
    gap: 6px;
    width: 100%;
    padding: 2px 12px;
    border: none;
    background: none;
    color: #a9b1d6;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  .result-line:hover {
    background: rgba(122, 162, 247, 0.08);
  }

  .line-number {
    color: #565f89;
    flex-shrink: 0;
    min-width: 24px;
  }

  .line-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
