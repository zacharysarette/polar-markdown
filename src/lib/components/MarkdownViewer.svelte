<script lang="ts">
  import { renderMarkdown, renderMermaidDiagrams } from "../services/markdown";

  let {
    content = "",
    filePath = "",
  }: {
    content?: string;
    filePath?: string;
  } = $props();

  let htmlContent = $state("");

  $effect(() => {
    if (content) {
      renderMarkdown(content).then((html) => {
        htmlContent = html;
      });
    } else {
      htmlContent = "";
    }
  });

  // After HTML updates, render any mermaid diagrams
  $effect(() => {
    if (htmlContent) {
      // Use requestAnimationFrame to wait for DOM update
      requestAnimationFrame(() => {
        renderMermaidDiagrams().catch(() => {
          // Mermaid errors are non-fatal (e.g. invalid diagram syntax)
        });
      });
    }
  });

  const fileName = $derived(filePath ? filePath.split(/[\\/]/).pop() ?? "" : "");
</script>

<div class="viewer" role="main" aria-label="Markdown viewer">
  {#if content}
    <header class="viewer-header">
      <span class="file-name" title={filePath}>{fileName}</span>
    </header>
    <article class="markdown-body">
      {@html htmlContent}
    </article>
  {:else}
    <div class="empty-state">
      <div class="empty-icon">📝</div>
      <h2>Planning Central</h2>
      <p>Select a markdown file from the sidebar to view it.</p>
    </div>
  {/if}
</div>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .viewer-header {
    padding: 12px 24px;
    border-bottom: 1px solid #2f3146;
    flex-shrink: 0;
  }

  .file-name {
    font-size: 13px;
    color: #7aa2f7;
    font-weight: 500;
  }

  .markdown-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
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
