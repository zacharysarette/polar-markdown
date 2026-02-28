<script lang="ts">
  import { renderMarkdown, renderMermaidDiagrams, renderBobDiagrams } from "../services/markdown";
  import { extractDiagramLabels, getCodeBlockLineOverlayPosition } from "../services/highlight";
  import type { LayoutMode } from "../types";

  let {
    content = "",
    filePath = "",
    layoutMode = "centered" as LayoutMode,
    onlayoutchange,
    highlightText = "",
    highlightKey = 0,
  }: {
    content?: string;
    filePath?: string;
    layoutMode?: LayoutMode;
    onlayoutchange?: (mode: LayoutMode) => void;
    highlightText?: string;
    highlightKey?: number;
  } = $props();

  let htmlContent = $state("");
  let articleEl: HTMLElement | undefined = $state();
  let diagramsReady = $state(0);

  $effect(() => {
    if (content) {
      renderMarkdown(content, filePath).then((html) => {
        htmlContent = html;
      });
    } else {
      htmlContent = "";
    }
  });

  // After HTML updates, render any mermaid and svgbob diagrams
  $effect(() => {
    if (htmlContent) {
      // Use requestAnimationFrame to wait for DOM update
      requestAnimationFrame(async () => {
        try { await renderMermaidDiagrams(); } catch {
          // Mermaid errors are non-fatal (e.g. invalid diagram syntax)
        }
        try { await renderBobDiagrams(); } catch {
          // Bob diagram errors are non-fatal
        }
        // Signal that diagrams are ready so highlight effect re-fires
        diagramsReady++;
      });
    }
  });

  // Highlight and scroll to matching text from search results
  $effect(() => {
    const text = highlightText;
    const el = articleEl;
    const _key = highlightKey; // depend on key to re-fire on repeated clicks
    const _html = htmlContent; // re-fire when content renders
    const _ready = diagramsReady; // re-fire after diagrams finish rendering
    if (!text || !el || !_html) return;

    // Wait for DOM to be updated with the new content
    const frame = requestAnimationFrame(() => {
      highlightAndScroll(el, text);
    });

    // Cleanup: cancel pending RAF when effect re-runs (e.g. content changes)
    return () => cancelAnimationFrame(frame);
  });

  function clearHighlights(container: HTMLElement) {
    // Remove <mark> highlights
    container.querySelectorAll("mark.search-highlight").forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
        parent.normalize();
      }
    });
    // Remove element-level highlights
    container.querySelectorAll(".search-highlight-line").forEach((el) => {
      el.classList.remove("search-highlight-line");
    });
    // Remove line overlays
    container.querySelectorAll(".search-line-overlay").forEach((el) => {
      el.remove();
    });
  }

  function highlightAndScroll(container: HTMLElement, text: string) {
    clearHighlights(container);

    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Strategy 1: Exact text node match (paragraphs, headings, plain text)
    if (tryTextNodeHighlight(container, trimmedText)) return;

    // Strategy 2: Code block line highlight (syntax-highlighted code)
    if (tryCodeBlockLineHighlight(container, trimmedText)) return;

    // Strategy 3: SVG/diagram container (svgbob, mermaid — original text gone)
    if (tryDiagramContainerHighlight(container, trimmedText)) return;
  }

  function tryTextNodeHighlight(container: HTMLElement, text: string): boolean {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      // Skip text nodes inside <pre> (code blocks) — handled by Strategy 2
      if (node.parentElement?.closest("pre")) continue;

      const idx = node.textContent?.indexOf(text) ?? -1;
      if (idx === -1) continue;

      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + text.length);

      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      range.surroundContents(mark);

      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
  }

  function tryCodeBlockLineHighlight(container: HTMLElement, text: string): boolean {
    const pres = container.querySelectorAll("pre");
    for (const pre of pres) {
      const pos = getCodeBlockLineOverlayPosition(pre as HTMLElement, text);
      if (!pos) continue;

      pre.style.position = "relative";

      const overlay = document.createElement("div");
      overlay.className = "search-line-overlay";
      overlay.style.position = "absolute";
      overlay.style.left = "0";
      overlay.style.right = "0";
      overlay.style.top = `${pos.top}px`;
      overlay.style.height = `${pos.height}px`;
      overlay.style.pointerEvents = "none";

      pre.appendChild(overlay);
      overlay.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
  }

  function tryDiagramContainerHighlight(container: HTMLElement, text: string): boolean {
    // SVG diagrams (svgbob, mermaid) replace source text with SVG graphics.
    // Extract meaningful labels from the raw diagram syntax, then search
    // SVG <text> elements for those labels.

    const labels = extractDiagramLabels(text);

    // Strategy A: Search for extracted labels in SVG text elements
    if (labels.length > 0) {
      const diagramPres = container.querySelectorAll("pre.mermaid, pre.bob-rendered, pre:has(svg)");
      for (const pre of diagramPres) {
        const svgTexts = pre.querySelectorAll("text");
        for (const svgText of svgTexts) {
          const tc = (svgText.textContent ?? "").trim();
          if (!tc) continue;
          for (const label of labels) {
            if (tc.includes(label)) {
              pre.classList.add("search-highlight-line");
              pre.scrollIntoView({ behavior: "smooth", block: "center" });
              return true;
            }
          }
        }
      }
    }

    // Strategy B: Direct text search in SVG text elements (non-mermaid syntax)
    const svgTexts = container.querySelectorAll("svg text");
    for (const svgText of svgTexts) {
      const tc = svgText.textContent ?? "";
      if (tc.includes(text)) {
        const pre = svgText.closest("pre");
        if (pre) {
          pre.classList.add("search-highlight-line");
          pre.scrollIntoView({ behavior: "smooth", block: "center" });
          return true;
        }
      }
    }

    // Strategy C: Word matching fallback with cleaned-up words
    // Strip diagram syntax characters before extracting words
    const cleanText = text.replace(/[\[\](){}<>|#*`~\-=>/\\]/g, " ");
    const words = cleanText.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return false;

    const diagramContainers = container.querySelectorAll(
      "pre.bob-rendered, pre.mermaid, pre:has(svg)"
    );
    for (const dc of diagramContainers) {
      const tc = dc.textContent ?? "";
      const matchCount = words.filter((w) => tc.toLowerCase().includes(w.toLowerCase())).length;
      if (matchCount >= Math.ceil(words.length * 0.6)) {
        dc.classList.add("search-highlight-line");
        dc.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
    }

    return false;
  }

  const fileName = $derived(filePath ? filePath.split(/[\\/]/).pop() ?? "" : "");
</script>

<div class="viewer" role="main" aria-label="Markdown viewer">
  {#if content}
    <header class="viewer-header">
      <span class="file-name" title={filePath}>{fileName}</span>
      <div class="layout-controls">
        <button class:active={layoutMode === "centered"} onclick={() => onlayoutchange?.("centered")} title="Single column">&#x2261;</button>
        <button class:active={layoutMode === "columns"} onclick={() => onlayoutchange?.("columns")} title="Multi-column">&#x229E;</button>
      </div>
    </header>
    <article class="markdown-body" class:centered={layoutMode === "centered"} class:columns={layoutMode === "columns"} bind:this={articleEl}>
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
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .file-name {
    font-size: 13px;
    color: #7aa2f7;
    font-weight: 500;
  }

  .layout-controls {
    display: flex;
    gap: 4px;
  }

  .layout-controls button {
    background: transparent;
    border: 1px solid #2f3146;
    color: #565f89;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .layout-controls button:hover {
    border-color: #7aa2f7;
    color: #7aa2f7;
  }

  .layout-controls button.active {
    background: #1a1b2e;
    border-color: #7aa2f7;
    color: #7aa2f7;
  }

  .markdown-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
  }

  .markdown-body.centered {
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .markdown-body.columns {
    column-width: 400px;
    column-gap: 48px;
    column-rule: 1px solid #2f3146;
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
