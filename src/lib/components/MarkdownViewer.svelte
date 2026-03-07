<script lang="ts">
  import { tick } from "svelte";
  import { renderMarkdown, renderMermaidDiagrams, renderBobDiagrams, getDirectory, resolvePath } from "../services/markdown";
  import type { MermaidRenderResult } from "../services/markdown";
  import { open } from "@tauri-apps/plugin-shell";
  import { extractDiagramLabels, getCodeBlockLineOverlayPosition, stripMarkdownSyntax, findMatchingBlockElement, findMatchingPreElement, clearBlockHighlights, getTableCellIndex, clearLineHeightCache } from "../services/highlight";
  import Backlinks from "./Backlinks.svelte";
  import type { LayoutMode, SearchResult } from "../types";

  let {
    content = "",
    filePath = "",
    layoutMode = "centered" as LayoutMode,
    onlayoutchange,
    showLineNumbers = false,
    onlinenumberschange,
    highlightText = "",
    highlightKey = 0,
    activeLineText = "",
    activeLineNumber = 1,
    activeTotalLines = 1,
    activeColumn = 1,
    showHeader = true,
    onfilelink,
    scrollToId = "",
    zoomLevel = 1.0,
    onautofix,
    onactiveheadingchange,
    backlinks = [],
    onbacklinkselect,
  }: {
    content?: string;
    filePath?: string;
    layoutMode?: LayoutMode;
    onlayoutchange?: (mode: LayoutMode) => void;
    showLineNumbers?: boolean;
    onlinenumberschange?: (enabled: boolean) => void;
    highlightText?: string;
    highlightKey?: number;
    activeLineText?: string;
    activeLineNumber?: number;
    activeTotalLines?: number;
    activeColumn?: number;
    showHeader?: boolean;
    onfilelink?: (path: string, hash?: string, ctrlKey?: boolean) => void;
    scrollToId?: string;
    zoomLevel?: number;
    onautofix?: () => void;
    onactiveheadingchange?: (slug: string) => void;
    backlinks?: SearchResult[];
    onbacklinkselect?: (path: string) => void;
  } = $props();

  let htmlContent = $state("");
  let articleEl: HTMLElement | undefined = $state();
  let contentReady = $state(0);
  let mermaidStatus: MermaidRenderResult | null = $state(null);
  let contentReadyTimer: ReturnType<typeof setTimeout> | undefined;
  let diagramDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  // Cached block elements for active line highlight (invalidated when htmlContent changes)
  let cachedBlocks: HTMLElement[] | undefined;
  // Timestamp of last search-driven scroll — active line scroll is suppressed briefly after
  let lastSearchScrollTime = 0;
  // Timestamp until which IntersectionObserver heading updates are suppressed (TOC scroll lock)
  let tocScrollLockUntil = 0;

  function signalContentReady() {
    if (contentReadyTimer) clearTimeout(contentReadyTimer);
    contentReadyTimer = setTimeout(() => { contentReady++; }, 200);
  }

  $effect(() => {
    const _lineNumbers = showLineNumbers; // depend on toggle
    if (content) {
      renderMarkdown(content, filePath, { sourceLineNumbers: showLineNumbers }).then(async (html) => {
        htmlContent = html;
        cachedBlocks = undefined; // Invalidate block cache on content change
        clearLineHeightCache();
        // Re-apply active line highlight immediately after DOM update.
        // tick() resolves after Svelte updates the DOM but before the browser paints,
        // so the highlight is applied in the same frame — no visible flicker.
        await tick();
        applyActiveLineToDOM(false);
      });
    } else {
      htmlContent = "";
      cachedBlocks = undefined;
    }
  });

  // After HTML updates, render any mermaid and svgbob diagrams (debounced at 1000ms)
  $effect(() => {
    if (htmlContent) {
      mermaidStatus = null;
      if (diagramDebounceTimer) clearTimeout(diagramDebounceTimer);
      diagramDebounceTimer = setTimeout(() => {
        requestAnimationFrame(async () => {
          try {
            const result = await renderMermaidDiagrams();
            mermaidStatus = result.total > 0 ? result : null;
          } catch {
            // Mermaid errors are non-fatal
          }
          try { await renderBobDiagrams(); } catch {
            // Bob diagram errors are non-fatal
          }
          // Signal that content is ready so highlight effect re-fires
          signalContentReady();
        });
      }, 1000);

      return () => {
        if (diagramDebounceTimer) clearTimeout(diagramDebounceTimer);
      };
    }
  });

  // After HTML updates, watch for image loads that cause layout shifts
  $effect(() => {
    const el = articleEl;
    const _html = htmlContent;
    if (!el || !_html) return;

    const images = el.querySelectorAll('img');
    if (images.length === 0) return;

    const onLoad = () => { signalContentReady(); };

    const pending: HTMLImageElement[] = [];
    images.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onLoad, { once: true });
        pending.push(img);
      }
    });

    return () => {
      pending.forEach(img => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onLoad);
      });
    };
  });

  // Highlight and scroll to matching text from search results
  $effect(() => {
    const text = highlightText;
    const el = articleEl;
    const _key = highlightKey; // depend on key to re-fire on repeated clicks
    const _html = htmlContent; // re-fire when content renders
    const _ready = contentReady; // re-fire after diagrams/images are ready (unified, debounced)
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
    // Remove block-level highlights
    clearBlockHighlights(container, "search-highlight-block");
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
    if (tryTextNodeHighlight(container, trimmedText)) { lastSearchScrollTime = Date.now(); return; }

    // Strategy 1b: Strip markdown syntax and try text node match again
    const stripped = stripMarkdownSyntax(trimmedText);
    if (stripped !== trimmedText && stripped.length >= 2) {
      if (tryTextNodeHighlight(container, stripped)) { lastSearchScrollTime = Date.now(); return; }
    }

    // Strategy 1c: Block-level fallback — highlight the entire block element
    if (stripped.length >= 2) {
      if (tryBlockHighlight(container, stripped)) { lastSearchScrollTime = Date.now(); return; }
    }

    // Strategy 2: Code block line highlight (syntax-highlighted code)
    if (tryCodeBlockLineHighlight(container, trimmedText)) { lastSearchScrollTime = Date.now(); return; }

    // Strategy 3: SVG/diagram container (svgbob, mermaid — original text gone)
    if (tryDiagramContainerHighlight(container, trimmedText)) { lastSearchScrollTime = Date.now(); return; }
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

  function tryBlockHighlight(container: HTMLElement, text: string): boolean {
    const block = findMatchingBlockElement(container, text);
    if (!block) return false;
    block.classList.add("search-highlight-block");
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
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

  function getBlockCache(): HTMLElement[] {
    if (!cachedBlocks && articleEl) {
      const blockSelectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th, dd, dt';
      const allBlocks = Array.from(articleEl.querySelectorAll(blockSelectors));
      cachedBlocks = allBlocks.filter(b => !b.closest('pre')) as HTMLElement[];
    }
    return cachedBlocks ?? [];
  }

  // Shared function to apply active line highlight to the preview DOM.
  // Called from two places: (1) the cursor-movement $effect, (2) after markdown re-render.
  // When scroll=false (after re-render), we only re-apply the class without scrolling.
  function applyActiveLineToDOM(scroll: boolean) {
    const el = articleEl;
    if (!el) return;

    // Clear previous highlights and overlays
    clearBlockHighlights(el, "active-line-block");
    el.querySelectorAll(".active-line-overlay").forEach(o => o.remove());

    const text = activeLineText;
    if (!text.trim()) return;

    const shouldScroll = scroll && Date.now() - lastSearchScrollTime > 500;
    const positionRatio = activeTotalLines > 1 ? (activeLineNumber - 1) / (activeTotalLines - 1) : 0;
    const stripped = stripMarkdownSyntax(text);
    const cellIndex = getTableCellIndex(text, activeColumn);

    // Strategy 1: Match normal block elements (p, h1-h6, li, td, th, etc.)
    if (stripped.length >= 2) {
      const block = findMatchingBlockElement(el, stripped, positionRatio, cellIndex >= 0 ? cellIndex : undefined, getBlockCache());
      if (block) {
        block.classList.add("active-line-block");
        if (shouldScroll) block.scrollIntoView({ behavior: "instant", block: "center" });
        return;
      }
    }

    // Strategy 2: Match code blocks and diagrams by raw line text
    const rawTrimmed = text.trim();
    if (rawTrimmed.length >= 2) {
      const pre = findMatchingPreElement(el, rawTrimmed);
      if (pre) {
        const pos = getCodeBlockLineOverlayPosition(pre as HTMLElement, rawTrimmed);
        if (pos) {
          pre.style.position = "relative";
          const overlay = document.createElement("div");
          overlay.className = "active-line-overlay";
          overlay.style.position = "absolute";
          overlay.style.left = "0";
          overlay.style.right = "0";
          overlay.style.top = `${pos.top}px`;
          overlay.style.height = `${pos.height}px`;
          overlay.style.pointerEvents = "none";
          pre.appendChild(overlay);
          if (shouldScroll) overlay.scrollIntoView({ behavior: "instant", block: "center" });
        } else {
          pre.classList.add("active-line-block");
          if (shouldScroll) pre.scrollIntoView({ behavior: "instant", block: "center" });
        }
      }
    }
  }

  // Active line highlight on cursor movement — does NOT depend on htmlContent
  $effect(() => {
    const _text = activeLineText;
    const _lineNum = activeLineNumber;
    const _totalLines = activeTotalLines;
    const _col = activeColumn;
    const _el = articleEl;
    if (!_el) return;

    const frame = requestAnimationFrame(() => {
      applyActiveLineToDOM(true);
    });

    return () => cancelAnimationFrame(frame);
  });

  function handleAnchorClick(event: MouseEvent) {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;

    // Branch 1: #hash anchor links — scroll within the page
    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (!id || !articleEl) return;
      const target = articleEl.querySelector(`#${CSS.escape(id)}`);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    // Branch 2: External links (http/https) — open in system browser
    if (/^https?:\/\//i.test(href)) {
      event.preventDefault();
      open(href);
      return;
    }

    // Branch 3: .md file links — navigate within app
    // Split href into path and optional hash: "file.md#section" → ["file.md", "section"]
    const [linkPath, hash] = href.split("#", 2);
    const decodedPath = decodeURIComponent(linkPath);
    if (decodedPath.endsWith(".md")) {
      event.preventDefault();
      const dir = getDirectory(filePath);
      const resolvedPath = dir ? resolvePath(dir, decodedPath) : decodedPath;
      onfilelink?.(resolvedPath, hash || undefined, event.ctrlKey);
      return;
    }
  }

  // Scroll to a heading by ID when scrollToId changes (e.g. after opening file.md#section)
  $effect(() => {
    const id = scrollToId;
    const el = articleEl;
    const _html = htmlContent;
    if (!id || !el || !_html) return;

    const frame = requestAnimationFrame(() => {
      const target = el.querySelector(`#${CSS.escape(id)}`);
      if (target) {
        tocScrollLockUntil = Date.now() + 1000;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    return () => cancelAnimationFrame(frame);
  });

  // Track active heading via IntersectionObserver for TOC highlighting
  $effect(() => {
    const el = articleEl;
    const _html = htmlContent;
    const callback = onactiveheadingchange;
    if (!el || !_html || !callback) return;

    const headings = el.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
    if (headings.length === 0) return;

    const visibleIds = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) {
            visibleIds.add(id);
          } else {
            visibleIds.delete(id);
          }
        }
        // Suppress updates during TOC-initiated scroll to prevent jitter
        if (Date.now() < tocScrollLockUntil) return;
        // Find the topmost visible heading in DOM order
        for (const heading of headings) {
          if (visibleIds.has((heading as HTMLElement).id)) {
            callback((heading as HTMLElement).id);
            return;
          }
        }
      },
      { root: el, rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  });

  const fileName = $derived(filePath ? filePath.split(/[\\/]/).pop() ?? "" : "");
</script>

<div class="viewer" role="main" aria-label="Markdown viewer">
  {#if content}
    {#if showHeader}
      <header class="viewer-header">
        <span class="file-name" title={filePath}>{fileName}</span>
        {#if mermaidStatus}
          <span class="mermaid-status" class:has-errors={mermaidStatus.errorCount > 0}>
            {#if mermaidStatus.errorCount > 0}
              {mermaidStatus.errorCount} of {mermaidStatus.total} diagram{mermaidStatus.total === 1 ? '' : 's'} failed
              {#if onautofix}
                <button class="autofix-link" onclick={onautofix}>Try Auto-Fix</button>
              {/if}
            {:else}
              {mermaidStatus.total} diagram{mermaidStatus.total === 1 ? '' : 's'} OK
            {/if}
          </span>
        {/if}
        <div class="layout-controls">
          {#if zoomLevel !== 1.0}
            <span class="zoom-indicator">{Math.round(zoomLevel * 100)}%</span>
          {/if}
          <button class="line-numbers-toggle" class:active={showLineNumbers} onclick={() => onlinenumberschange?.(!showLineNumbers)} title="Toggle source line numbers">1:</button>
          <button class:active={layoutMode === "centered"} onclick={() => onlayoutchange?.("centered")} title="Single column">&#x2261;</button>
          <button class:active={layoutMode === "columns"} onclick={() => onlayoutchange?.("columns")} title="Multi-column">&#x229E;</button>
        </div>
      </header>
    {/if}
    <article class="markdown-body" class:centered={layoutMode === "centered"} class:columns={layoutMode === "columns"} class:show-source-lines={showLineNumbers} bind:this={articleEl} onclick={handleAnchorClick} style="font-size: {15 * zoomLevel}px">
      {@html htmlContent}
    </article>
    <Backlinks {backlinks} onselect={onbacklinkselect} />
  {:else}
    <div class="empty-state">
      <div class="empty-icon">🏔️</div>
      <h2>Glacimark</h2>
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
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .file-name {
    font-size: 13px;
    color: var(--accent);
    font-weight: 500;
  }

  .mermaid-status {
    font-size: 11px;
    color: var(--green);
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--green-hover);
  }

  .mermaid-status.has-errors {
    color: var(--red);
    background: var(--red-hover);
  }

  .autofix-link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 11px;
    text-decoration: underline;
    padding: 0 4px;
  }

  .autofix-link:hover {
    color: var(--text);
  }

  .layout-controls {
    display: flex;
    gap: 4px;
  }

  .layout-controls button {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
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
    border-color: var(--accent);
    color: var(--accent);
  }

  .layout-controls button.active {
    background: var(--bg-secondary);
    border-color: var(--accent);
    color: var(--accent);
  }

  .zoom-indicator {
    font-size: 11px;
    color: var(--text-muted);
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  }

  .line-numbers-toggle {
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-size: 12px;
    font-weight: 600;
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
    column-rule: 1px solid var(--border);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    gap: 12px;
  }

  .empty-icon {
    font-size: 48px;
  }

  .empty-state h2 {
    color: var(--accent);
    font-size: 24px;
  }

  .empty-state p {
    font-size: 14px;
  }
</style>
