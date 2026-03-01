<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import MarkdownEditor from "./MarkdownEditor.svelte";
  import MarkdownViewer from "./MarkdownViewer.svelte";

  let {
    content = "",
    filePath = "",
    onsave,
    highlightText = "",
    highlightKey = 0,
  }: {
    content?: string;
    filePath?: string;
    onsave?: (path: string, content: string) => void;
    highlightText?: string;
    highlightKey?: number;
  } = $props();

  let editContent = $state(content);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let activeLineDebounce: ReturnType<typeof setTimeout> | undefined;
  let activeLineText = $state("");
  let activeLineNumber = $state(1);
  let activeTotalLines = $state(1);
  let activeColumn = $state(1);
  let paneEl: HTMLDivElement | undefined = $state();

  // Scroll wheel sync between editor and preview
  let syncing = false;
  let cleanupScrollSync: (() => void) | undefined;

  function setupScrollSync() {
    cleanupScrollSync?.();
    if (!paneEl) return;

    const editorScroller = paneEl.querySelector('.cm-scroller') as HTMLElement | null;
    const previewScroller = paneEl.querySelector('.markdown-body') as HTMLElement | null;
    if (!editorScroller || !previewScroller) return;

    function syncScroll(source: HTMLElement, target: HTMLElement) {
      if (syncing) return;
      const maxSource = source.scrollHeight - source.clientHeight;
      const maxTarget = target.scrollHeight - target.clientHeight;
      if (maxSource <= 0 || maxTarget <= 0) return;
      const ratio = source.scrollTop / maxSource;
      syncing = true;
      target.scrollTop = ratio * maxTarget;
      requestAnimationFrame(() => { syncing = false; });
    }

    function onEditorScroll() { syncScroll(editorScroller!, previewScroller!); }
    function onPreviewScroll() { syncScroll(previewScroller!, editorScroller!); }

    editorScroller.addEventListener('scroll', onEditorScroll);
    previewScroller.addEventListener('scroll', onPreviewScroll);

    cleanupScrollSync = () => {
      editorScroller.removeEventListener('scroll', onEditorScroll);
      previewScroller.removeEventListener('scroll', onPreviewScroll);
    };
  }

  // Set up scroll sync after mount and whenever content changes (DOM may rebuild)
  onMount(() => {
    // Delay slightly to let CodeMirror mount its .cm-scroller
    const timer = setTimeout(setupScrollSync, 100);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    // Re-setup when editContent changes (preview re-renders)
    const _content = editContent;
    // Small delay to let DOM update
    const timer = setTimeout(setupScrollSync, 100);
    return () => clearTimeout(timer);
  });

  onDestroy(() => {
    cleanupScrollSync?.();
  });

  // When the file changes (navigation), sync editContent from the new prop value
  $effect(() => {
    filePath;
    editContent = content;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
  });

  function handleEdit(newContent: string) {
    editContent = newContent;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onsave?.(filePath, editContent);
    }, 1000);
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
    activeLineDebounce = setTimeout(() => {
      activeLineText = lineContent;
      activeLineNumber = lineNumber;
      activeTotalLines = totalLines;
      activeColumn = column;
    }, 50);
  }

  const fileName = $derived(filePath ? filePath.split(/[\\/]/).pop() ?? "" : "");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="editable-pane" onkeydown={handleKeyDown} bind:this={paneEl}>
  <div class="editor-side">
    <header class="editor-header">
      <span class="editor-label">Editor</span>
      <span class="cursor-pos">Ln {activeLineNumber}, Col {activeColumn}</span>
    </header>
    <div class="editor-content">
      <MarkdownEditor content={editContent} onchange={handleEdit} {highlightText} {highlightKey} onactiveline={handleActiveLine} />
    </div>
  </div>
  <div class="preview-side">
    <header class="preview-header">
      <span class="preview-label">Preview</span>
      <span class="preview-file" title={filePath}>{fileName}</span>
    </header>
    <MarkdownViewer content={editContent} {filePath} {highlightText} {highlightKey} {activeLineText} {activeLineNumber} {activeTotalLines} {activeColumn} showHeader={false} />
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
    border-right: 1px solid #2f3146;
  }

  .editor-header {
    padding: 6px 12px;
    border-bottom: 1px solid #2f3146;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1e1f2e;
    min-height: 32px;
  }

  .editor-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #7aa2f7;
  }

  .cursor-pos {
    font-size: 11px;
    color: #565f89;
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
    border-bottom: 1px solid #2f3146;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1e1f2e;
    min-height: 32px;
  }

  .preview-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #9ece6a;
  }

  .preview-file {
    font-size: 11px;
    color: #565f89;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
