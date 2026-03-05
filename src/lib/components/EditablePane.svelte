<script lang="ts">
  import { onMount } from "svelte";
  import MarkdownEditor from "./MarkdownEditor.svelte";
  import MarkdownViewer from "./MarkdownViewer.svelte";
  import type { ThemeType } from "../types";
  import { getLineWrapping, saveLineWrapping } from "../services/persistence";

  let {
    content = "",
    filePath = "",
    onsave,
    highlightText = "",
    highlightKey = 0,
    theme = "aurora" as ThemeType,
    onfilelink,
    zoomLevel = 1.0,
  }: {
    content?: string;
    filePath?: string;
    onsave?: (path: string, content: string) => void;
    highlightText?: string;
    highlightKey?: number;
    theme?: ThemeType;
    onfilelink?: (path: string, hash?: string, ctrlKey?: boolean) => void;
    zoomLevel?: number;
  } = $props();

  let lineWrapping = $state(getLineWrapping());

  function toggleLineWrapping() {
    lineWrapping = !lineWrapping;
    saveLineWrapping(lineWrapping);
  }

  let editContent = $state(content);
  let previewContent = $state(content);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let previewDebounce: ReturnType<typeof setTimeout> | undefined;
  let activeLineDebounce: ReturnType<typeof setTimeout> | undefined;
  let activeLineText = $state("");
  let activeLineNumber = $state(1);
  let activeTotalLines = $state(1);
  let activeColumn = $state(1);
  let paneEl: HTMLDivElement | undefined = $state();

  // Directional scroll sync: only sync FROM the active pane TO the passive pane
  let activePane: 'editor' | 'preview' | 'none' = $state('none');
  let activeLineDriving = false;
  let cleanupScrollSync: (() => void) | undefined;

  function setupScrollSync() {
    cleanupScrollSync?.();
    if (!paneEl) return;

    const editorScroller = paneEl.querySelector('.cm-scroller') as HTMLElement | null;
    const previewScroller = paneEl.querySelector('.markdown-body') as HTMLElement | null;
    if (!editorScroller || !previewScroller) return;

    function syncScrollTo(source: HTMLElement, target: HTMLElement) {
      const maxSource = source.scrollHeight - source.clientHeight;
      const maxTarget = target.scrollHeight - target.clientHeight;
      if (maxSource <= 0 || maxTarget <= 0) return;
      const ratio = source.scrollTop / maxSource;
      target.scrollTop = ratio * maxTarget;
    }

    function onEditorScroll() {
      if (activePane !== 'editor') return;
      if (activeLineDriving) return;
      syncScrollTo(editorScroller!, previewScroller!);
    }

    function onPreviewScroll() {
      if (activePane !== 'preview') return;
      syncScrollTo(previewScroller!, editorScroller!);
    }

    editorScroller.addEventListener('scroll', onEditorScroll);
    previewScroller.addEventListener('scroll', onPreviewScroll);

    cleanupScrollSync = () => {
      editorScroller.removeEventListener('scroll', onEditorScroll);
      previewScroller.removeEventListener('scroll', onPreviewScroll);
    };
  }

  // Set up scroll sync after mount (RAF ensures child onMount runs first)
  onMount(() => {
    const frame = requestAnimationFrame(setupScrollSync);
    return () => {
      cancelAnimationFrame(frame);
      cleanupScrollSync?.();
    };
  });

  // When the file changes (navigation), sync editContent and previewContent from the new prop value
  $effect(() => {
    filePath;
    editContent = content;
    previewContent = content;
    activePane = 'none';
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (previewDebounce) {
      clearTimeout(previewDebounce);
      previewDebounce = undefined;
    }
  });

  function handleEdit(newContent: string) {
    editContent = newContent;
    // Debounce preview update at 300ms to avoid re-rendering markdown/diagrams on every keystroke
    if (previewDebounce) clearTimeout(previewDebounce);
    previewDebounce = setTimeout(() => {
      previewContent = editContent;
    }, 300);
    // Debounce auto-save at 2000ms to reduce disk writes and watcher events
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onsave?.(filePath, editContent);
    }, 2000);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "s") {
      event.preventDefault();
      if (debounceTimer) clearTimeout(debounceTimer);
      onsave?.(filePath, editContent);
    }
  }

  function handleActiveLine(lineContent: string, lineNumber: number, totalLines: number, column: number) {
    if (activeLineDebounce) clearTimeout(activeLineDebounce);
    activeLineDriving = true;
    activeLineDebounce = setTimeout(() => {
      activeLineText = lineContent;
      activeLineNumber = lineNumber;
      activeTotalLines = totalLines;
      activeColumn = column;
      // Double-RAF: wait for MarkdownViewer's scrollIntoView to fire + settle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { activeLineDriving = false; });
      });
    }, 150);
  }

  const fileName = $derived(filePath ? filePath.split(/[\\/]/).pop() ?? "" : "");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="editable-pane" onkeydown={handleKeyDown} bind:this={paneEl}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="editor-side" onpointerdown={() => activePane = 'editor'} onwheel={() => activePane = 'editor'}>
    <header class="editor-header">
      <span class="editor-label">Editor</span>
      <span class="editor-controls">
        <button
          class="wrap-toggle"
          class:active={lineWrapping}
          onclick={toggleLineWrapping}
          title={lineWrapping ? "Disable line wrapping" : "Enable line wrapping"}
        >⏎</button>
        <span class="cursor-pos">Ln {activeLineNumber}, Col {activeColumn}</span>
      </span>
    </header>
    <div class="editor-content">
      <MarkdownEditor content={editContent} onchange={handleEdit} {highlightText} {highlightKey} onactiveline={handleActiveLine} {theme} {lineWrapping} {zoomLevel} />
    </div>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="preview-side" onpointerdown={() => activePane = 'preview'} onwheel={() => activePane = 'preview'}>
    <header class="preview-header">
      <span class="preview-label">Preview</span>
      <span class="preview-file" title={filePath}>{fileName}</span>
    </header>
    <MarkdownViewer content={previewContent} {filePath} {highlightText} {highlightKey} {activeLineText} {activeLineNumber} {activeTotalLines} {activeColumn} showHeader={false} {onfilelink} {zoomLevel} />
  </div>
</div>

<style>
  .editable-pane {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 100%;
    overflow: hidden;
  }

  .editor-side {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--border);
  }

  .editor-header {
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-secondary);
    min-height: 32px;
  }

  .editor-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent);
  }

  .editor-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wrap-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 5px;
    line-height: 1;
  }

  .wrap-toggle:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }

  .wrap-toggle.active {
    color: var(--accent);
    border-color: var(--accent);
  }

  .cursor-pos {
    font-size: 11px;
    color: var(--text-muted);
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  }

  .editor-content {
    flex: 1;
    overflow: hidden;
  }

  .preview-side {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .preview-header {
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-secondary);
    min-height: 32px;
  }

  .preview-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--green);
  }

  .preview-file {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
