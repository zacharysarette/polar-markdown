<script lang="ts">
  import MarkdownViewer from "./MarkdownViewer.svelte";
  import type { OpenPane, LayoutMode } from "../types";

  let {
    panes = [],
    activePaneId = "",
    layoutMode = "centered" as LayoutMode,
    onlayoutchange,
    onclosepane,
    onactivatepane,
    highlightText = "",
    highlightKey = 0,
  }: {
    panes?: OpenPane[];
    activePaneId?: string;
    layoutMode?: LayoutMode;
    onlayoutchange?: (mode: LayoutMode) => void;
    onclosepane?: (id: string) => void;
    onactivatepane?: (id: string) => void;
    highlightText?: string;
    highlightKey?: number;
  } = $props();
</script>

{#if panes.length === 0}
  <div class="empty-state" role="main" aria-label="Markdown viewer">
    <div class="empty-icon">📝</div>
    <h2>Planning Central</h2>
    <p>Select a markdown file from the sidebar to view it.</p>
  </div>
{:else}
  <div
    class="content-area"
    style="grid-template-columns: repeat({panes.length}, 1fr)"
  >
    {#each panes as pane (pane.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="pane"
        class:active={pane.id === activePaneId}
        onclick={() => onactivatepane?.(pane.id)}
      >
        <header class="pane-header">
          <span class="pane-filename" title={pane.path}>
            {pane.path.split(/[\\/]/).pop() ?? ""}
          </span>
          <button
            class="close-btn"
            title="Close pane"
            onclick={(e) => { e.stopPropagation(); onclosepane?.(pane.id); }}
          >×</button>
        </header>
        <MarkdownViewer
          content={pane.content}
          filePath={pane.path}
          {layoutMode}
          {onlayoutchange}
          highlightText={pane.id === activePaneId ? highlightText : ""}
          highlightKey={pane.id === activePaneId ? highlightKey : 0}
        />
      </div>
    {/each}
  </div>
{/if}

<style>
  .content-area {
    display: grid;
    height: 100%;
    overflow: hidden;
  }

  .pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border-left: 1px solid #2f3146;
  }

  .pane:first-child {
    border-left: none;
  }

  .pane-header {
    padding: 8px 12px;
    border-bottom: 1px solid #2f3146;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1a1b26;
  }

  .pane.active .pane-header {
    background: #1e1f2e;
  }

  .pane-filename {
    font-size: 12px;
    color: #565f89;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pane.active .pane-filename {
    color: #7aa2f7;
  }

  .close-btn {
    background: none;
    border: none;
    color: #565f89;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: #f7768e;
    background: rgba(247, 118, 142, 0.1);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #565f89;
    gap: 12px;
  }

  .empty-icon {
    font-size: 48px;
  }

  .empty-state h2 {
    color: #7aa2f7;
    font-size: 24px;
  }

  .empty-state p {
    font-size: 14px;
  }
</style>
