<script lang="ts">
  import { onMount } from "svelte";
  import MarkdownEditor from "./MarkdownEditor.svelte";
  import MarkdownViewer from "./MarkdownViewer.svelte";
  import type { ThemeType } from "../types";
  import { getLineWrapping, saveLineWrapping, getVimMode, saveVimMode, getSplitDirection, saveSplitDirection } from "../services/persistence";
  import type { SplitDirection } from "../services/persistence";
  import { fixMermaidInMarkdown } from "../services/mermaid-fixer";
  import { saveImage } from "../services/filesystem";
  import { generateImageFilename, fileToBytes, buildMarkdownImageRef } from "../services/image-paste";

  let {
    content = "",
    filePath = "",
    onsave,
    highlightText = "",
    highlightKey = 0,
    theme = "aurora" as ThemeType,
    onfilelink,
    zoomLevel = 1.0,
    onautofix,
    showDocStats = false,
    ondocstatstoggle,
    onclosepane,
  }: {
    content?: string;
    filePath?: string;
    onsave?: (path: string, content: string) => void;
    highlightText?: string;
    highlightKey?: number;
    theme?: ThemeType;
    onfilelink?: (path: string, hash?: string, ctrlKey?: boolean) => void;
    zoomLevel?: number;
    onautofix?: (fixCount: number) => void;
    showDocStats?: boolean;
    ondocstatstoggle?: () => void;
    onclosepane?: () => void;
  } = $props();

  let lineWrapping = $state(getLineWrapping());
  let vimEnabled = $state(getVimMode());
  let splitDirection: SplitDirection = $state(getSplitDirection());
  let vimMode = $state("");
  let vimKeyBuffer = $state("");

  function toggleLineWrapping() {
    lineWrapping = !lineWrapping;
    saveLineWrapping(lineWrapping);
  }

  function toggleSplitDirection() {
    splitDirection = splitDirection === "horizontal" ? "vertical" : "horizontal";
    saveSplitDirection(splitDirection);
    // Re-setup scroll sync since DOM structure changes
    requestAnimationFrame(setupScrollSync);
  }

  function toggleVim() {
    vimEnabled = !vimEnabled;
    saveVimMode(vimEnabled);
    if (!vimEnabled) { vimMode = ""; vimKeyBuffer = ""; }
  }

  function handleVimModeChange(mode: string) {
    vimMode = mode;
  }

  function handleVimKeyBuffer(keys: string) {
    vimKeyBuffer = keys;
  }

  function handleVimCommand(command: string) {
    if (command === "write") {
      if (debounceTimer) clearTimeout(debounceTimer);
      onsave?.(filePath, editContent);
    } else if (command === "quit") {
      onclosepane?.();
    }
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

    // Listen for menu-triggered save
    function handleGlacimarkSave() {
      if (debounceTimer) clearTimeout(debounceTimer);
      onsave?.(filePath, editContent);
    }
    // Listen for menu-triggered line wrapping toggle
    function handleGlacimarkToggleLineWrapping() {
      toggleLineWrapping();
    }

    document.addEventListener("glacimark-save", handleGlacimarkSave);
    document.addEventListener("glacimark-toggle-line-wrapping", handleGlacimarkToggleLineWrapping);

    return () => {
      cancelAnimationFrame(frame);
      cleanupScrollSync?.();
      document.removeEventListener("glacimark-save", handleGlacimarkSave);
      document.removeEventListener("glacimark-toggle-line-wrapping", handleGlacimarkToggleLineWrapping);
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

  function handleAutoFix() {
    const { result, totalFixes } = fixMermaidInMarkdown(editContent);
    if (totalFixes === 0) {
      onautofix?.(0);
      return;
    }
    editContent = result;
    previewContent = result;
    if (debounceTimer) clearTimeout(debounceTimer);
    onsave?.(filePath, editContent);
    onautofix?.(totalFixes);
  }

  async function handleImagePaste(file: File): Promise<string | null> {
    if (!filePath) return null;
    const sep = filePath.includes("\\") ? "\\" : "/";
    const parts = filePath.split(sep);
    parts.pop();
    const directory = parts.join(sep);
    const filename = generateImageFilename(file.type);
    const bytes = await fileToBytes(file);
    await saveImage(directory, filename, bytes);
    return buildMarkdownImageRef(filename);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey && event.shiftKey && event.key === "F") {
      event.preventDefault();
      handleAutoFix();
      return;
    }
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
<div class="editable-pane" class:vertical={splitDirection === "vertical"} onkeydown={handleKeyDown} bind:this={paneEl}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="editor-side" onpointerdown={() => activePane = 'editor'} onwheel={() => activePane = 'editor'}>
    <header class="editor-header">
      <span class="editor-label">Editor</span>
      <span class="editor-controls">
        <button
          class="split-toggle"
          onclick={toggleSplitDirection}
          title={splitDirection === "horizontal" ? "Switch to vertical split" : "Switch to horizontal split"}
        >{splitDirection === "horizontal" ? "\u2B07" : "\u27A1"}</button>
        <button
          class="autofix-btn"
          onclick={handleAutoFix}
          title="Auto-fix mermaid diagrams (Ctrl+Shift+F)"
        >&#x1F527;</button>
        <button
          class="wrap-toggle"
          class:active={lineWrapping}
          onclick={toggleLineWrapping}
          title={lineWrapping ? "Disable line wrapping" : "Enable line wrapping"}
        >⏎</button>
        <button
          class="vim-toggle"
          class:active={vimEnabled}
          onclick={toggleVim}
          title={vimEnabled ? "Disable vim mode" : "Enable vim mode"}
        >VIM</button>
        <span class="cursor-pos">Ln {activeLineNumber}, Col {activeColumn}</span>
        {#if vimEnabled}
          <span class="vim-mode">-- {(vimMode || "NORMAL").toUpperCase()} --</span>
          {#if vimKeyBuffer}
            <span class="vim-keys">{vimKeyBuffer}</span>
          {/if}
        {/if}
      </span>
    </header>
    <div class="editor-content">
      <MarkdownEditor content={editContent} onchange={handleEdit} {highlightText} {highlightKey} onactiveline={handleActiveLine} {theme} {lineWrapping} {zoomLevel} onimagepaste={handleImagePaste} {vimEnabled} onvimmodechange={handleVimModeChange} onvimkeybuffer={handleVimKeyBuffer} onvimcommand={handleVimCommand} />
    </div>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="preview-side" onpointerdown={() => activePane = 'preview'} onwheel={() => activePane = 'preview'}>
    <header class="preview-header">
      <span class="preview-label">Preview</span>
      <span class="preview-file" title={filePath}>{fileName}</span>
    </header>
    <MarkdownViewer content={previewContent} {filePath} {highlightText} {highlightKey} {activeLineText} {activeLineNumber} {activeTotalLines} {activeColumn} showHeader={false} {onfilelink} {zoomLevel} {showDocStats} {ondocstatstoggle} />
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

  .autofix-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 5px;
    line-height: 1;
  }

  .autofix-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
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

  .vim-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    line-height: 1;
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  }

  .vim-toggle:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }

  .vim-toggle.active {
    color: var(--accent);
    border-color: var(--accent);
  }

  .cursor-pos {
    font-size: 11px;
    color: var(--text-muted);
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  }

  .vim-mode {
    font-size: 10px;
    color: var(--green);
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-weight: 600;
  }

  .vim-keys {
    font-size: 10px;
    color: var(--yellow, #e0af68);
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-weight: 600;
  }

  .split-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 5px;
    line-height: 1;
  }

  .split-toggle:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .editable-pane.vertical {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .editable-pane.vertical .editor-side {
    border-right: none;
    border-bottom: 1px solid var(--border);
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
