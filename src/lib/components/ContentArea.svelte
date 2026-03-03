<script lang="ts">
  import MarkdownViewer from "./MarkdownViewer.svelte";
  import EditablePane from "./EditablePane.svelte";
  import type { OpenPane, LayoutMode } from "../types";

  let {
    panes = [],
    activePaneId = "",
    layoutMode = "centered" as LayoutMode,
    onlayoutchange,
    onclosepane,
    onactivatepane,
    ontoggleedit,
    onsave,
    onsaveas,
    highlightText = "",
    highlightKey = 0,
  }: {
    panes?: OpenPane[];
    activePaneId?: string;
    layoutMode?: LayoutMode;
    onlayoutchange?: (mode: LayoutMode) => void;
    onclosepane?: (id: string) => void;
    onactivatepane?: (id: string) => void;
    ontoggleedit?: (id: string) => void;
    onsave?: (path: string, content: string) => void;
    onsaveas?: (id: string) => void;
    highlightText?: string;
    highlightKey?: number;
  } = $props();

  let copiedPaneId = $state("");

  function copyPath(paneId: string, path: string) {
    navigator.clipboard.writeText(path);
    copiedPaneId = paneId;
    setTimeout(() => { copiedPaneId = ""; }, 1500);
  }
</script>

{#if panes.length === 0}
  <div class="empty-state" role="main" aria-label="Markdown viewer">
    <div class="empty-icon">📝</div>
    <h2>Polar Markdown</h2>
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
          <div class="pane-actions">
            {#if pane.readOnly}
              <span class="read-only-badge">Read Only</span>
            {:else}
              <div class="mode-toggle">
                <button
                  class="mode-btn"
                  class:mode-active={!pane.editMode}
                  title="View Mode (Ctrl+E)"
                  onclick={(e) => { e.stopPropagation(); if (pane.editMode) ontoggleedit?.(pane.id); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button
                  class="mode-btn"
                  class:mode-active={pane.editMode}
                  title="Edit Mode (Ctrl+E)"
                  onclick={(e) => { e.stopPropagation(); if (!pane.editMode) ontoggleedit?.(pane.id); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
              </div>
            {/if}
            {#if !pane.readOnly}
              <button
                class="save-as-btn"
                title="Save As (Ctrl+Shift+S)"
                onclick={(e) => { e.stopPropagation(); onsaveas?.(pane.id); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </button>
            {/if}
            <button
              class="copy-path-btn"
              title="Copy file path"
              onclick={(e) => { e.stopPropagation(); copyPath(pane.id, pane.path); }}
            >
              {#if copiedPaneId === pane.id}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {:else}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {/if}
            </button>
            <button
              class="close-btn"
              title="Close pane (Ctrl+W)"
              onclick={(e) => { e.stopPropagation(); onclosepane?.(pane.id); }}
            >×</button>
          </div>
        </header>
        {#if pane.editMode}
          <EditablePane
            content={pane.content}
            filePath={pane.path}
            {onsave}
            highlightText={pane.id === activePaneId ? highlightText : ""}
            highlightKey={pane.id === activePaneId ? highlightKey : 0}
          />
        {:else}
          <MarkdownViewer
            content={pane.content}
            filePath={pane.path}
            {layoutMode}
            {onlayoutchange}
            highlightText={pane.id === activePaneId ? highlightText : ""}
            highlightKey={pane.id === activePaneId ? highlightKey : 0}
          />
        {/if}
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

  .pane-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .mode-toggle {
    display: flex;
    border: 1px solid #2f3146;
    border-radius: 4px;
    overflow: hidden;
  }

  .mode-btn {
    background: none;
    border: none;
    color: #565f89;
    cursor: pointer;
    padding: 3px 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mode-btn:first-child {
    border-right: 1px solid #2f3146;
  }

  .mode-btn:hover {
    color: #7aa2f7;
    background: rgba(122, 162, 247, 0.1);
  }

  .mode-btn.mode-active {
    color: #7aa2f7;
    background: rgba(122, 162, 247, 0.15);
  }

  .read-only-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #e0af68;
    background: rgba(224, 175, 104, 0.12);
    border: 1px solid rgba(224, 175, 104, 0.3);
    border-radius: 4px;
    padding: 2px 8px;
    line-height: 1;
  }

  .save-as-btn {
    background: none;
    border: none;
    color: #565f89;
    cursor: pointer;
    padding: 3px 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .save-as-btn:hover {
    color: #7aa2f7;
    background: rgba(122, 162, 247, 0.1);
  }

  .copy-path-btn {
    background: none;
    border: none;
    color: #565f89;
    cursor: pointer;
    padding: 3px 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .copy-path-btn:hover {
    color: #7aa2f7;
    background: rgba(122, 162, 247, 0.1);
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
