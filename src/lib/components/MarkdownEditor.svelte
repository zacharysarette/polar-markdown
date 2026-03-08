<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { ThemeType } from "../types";
  import { getImageFromTransfer } from "../services/image-paste";

  let {
    content = "",
    onchange,
    highlightText = "",
    highlightKey = 0,
    onactiveline,
    theme = "aurora" as ThemeType,
    lineWrapping = true,
    zoomLevel = 1.0,
    onimagepaste,
    vimEnabled = false,
    onvimmodechange,
    onvimkeybuffer,
    onvimcommand,
  }: {
    content?: string;
    onchange?: (content: string) => void;
    highlightText?: string;
    highlightKey?: number;
    onactiveline?: (lineContent: string, lineNumber: number, totalLines: number, column: number) => void;
    theme?: ThemeType;
    lineWrapping?: boolean;
    zoomLevel?: number;
    onimagepaste?: (file: File) => Promise<string | null>;
    vimEnabled?: boolean;
    onvimmodechange?: (mode: string) => void;
    onvimkeybuffer?: (keys: string) => void;
    onvimcommand?: (command: string) => void;
  } = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let view: any;
  let suppressNextChange = false;

  // These are set during onMount once CodeMirror is loaded
  let reconfigureTheme: ((t: ThemeType) => void) | null = null;
  let reconfigureLineWrap: ((wrap: boolean) => void) | null = null;
  let reconfigureFontSize: ((zoom: number) => void) | null = null;
  let dispatchSearchHighlight: ((text: string, key: number, doc: string) => void) | null = null;
  let reconfigureVim: ((enabled: boolean) => void) | null = null;
  let cleanupVimPoller: (() => void) | null = null;

  // Module-level: ex commands registered once globally, callback updated per instance
  let vimExRegistered = false;
  let activeVimCommandHandler: ((cmd: string) => void) | null = null;

  onMount(async () => {
    if (!containerEl) return;

    try {
    const [
      { EditorView, Decoration },
      { EditorState, StateField, StateEffect, Compartment },
      { markdown },
      { basicSetup },
      { auroraTheme, glacierTheme },
      { mermaidLinter, lintGutter },
    ] = await Promise.all([
      import("@codemirror/view"),
      import("@codemirror/state"),
      import("@codemirror/lang-markdown"),
      import("codemirror"),
      import("../services/codemirror-themes"),
      import("../services/mermaid-linter"),
    ]);

    function getThemeExtension(t: ThemeType) {
      return t === "aurora" ? auroraTheme : glacierTheme;
    }

    const themeCompartment = new Compartment();
    const lineWrapCompartment = new Compartment();
    const fontSizeCompartment = new Compartment();
    const vimCompartment = new Compartment();
    const relLineCompartment = new Compartment();

    // Lazy-load vim extension if enabled at mount time
    let vimExtension: any = [];
    let VimApi: any = null;
    if (vimEnabled) {
      try {
        const vimMod = await import("@replit/codemirror-vim");
        vimExtension = vimMod.vim();
        VimApi = vimMod.Vim;
      } catch {
        // vim module failed to load
      }
    }

    function getFontSizeExtension(zoom: number) {
      return EditorView.theme({ "&": { fontSize: `${14 * zoom}px` } });
    }

    // Search highlight via CodeMirror decorations
    const setSearchText = StateEffect.define<string>();
    const searchMark = Decoration.mark({ class: "cm-search-highlight" });

    function computeSearchDecorations(state: any, text: string): any {
      if (!text.trim()) return Decoration.none;
      const trimmed = text.trim();
      const ranges: any[] = [];
      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        let pos = 0;
        while (pos < line.text.length) {
          const idx = line.text.indexOf(trimmed, pos);
          if (idx === -1) break;
          ranges.push(searchMark.range(line.from + idx, line.from + idx + trimmed.length));
          pos = idx + trimmed.length;
        }
      }
      return Decoration.set(ranges, true);
    }

    const searchHighlightField = StateField.define<{ text: string; decorations: any }>({
      create() {
        return { text: "", decorations: Decoration.none };
      },
      update(value, tr) {
        let text = value.text;
        for (const e of tr.effects) {
          if (e.is(setSearchText)) {
            text = e.value;
          }
        }
        if (text !== value.text || (tr.docChanged && text)) {
          return { text, decorations: computeSearchDecorations(tr.state, text) };
        }
        return value;
      },
      provide: (f) => EditorView.decorations.from(f, (v: any) => v.decorations),
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        themeCompartment.of(getThemeExtension(theme)),
        lineWrapCompartment.of(lineWrapping ? EditorView.lineWrapping : []),
        fontSizeCompartment.of(getFontSizeExtension(zoomLevel)),
        vimCompartment.of(vimExtension),
        relLineCompartment.of([]),
        searchHighlightField,
        mermaidLinter,
        lintGutter(),
        EditorView.domEventHandlers({
          paste(event: ClipboardEvent, editorView: any) {
            if (!onimagepaste || !event.clipboardData) return false;
            const file = getImageFromTransfer(event.clipboardData);
            if (!file) return false;
            event.preventDefault();
            const cursor = editorView.state.selection.main.head;
            onimagepaste(file).then((md) => {
              if (md) {
                editorView.dispatch({ changes: { from: cursor, insert: md } });
              }
            });
            return true;
          },
          drop(event: DragEvent, editorView: any) {
            if (!onimagepaste || !event.dataTransfer) return false;
            const file = getImageFromTransfer(event.dataTransfer);
            if (!file) return false;
            event.preventDefault();
            const pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY });
            const insertPos = pos ?? editorView.state.selection.main.head;
            onimagepaste(file).then((md) => {
              if (md) {
                editorView.dispatch({ changes: { from: insertPos, insert: md } });
              }
            });
            return true;
          },
        }),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
        }),
        EditorView.updateListener.of((update: any) => {
          if (update.docChanged) {
            if (suppressNextChange) {
              suppressNextChange = false;
              return;
            }
            onchange?.(update.state.doc.toString());
          }
          if ((update.selectionSet || update.docChanged) && update.state.selection) {
            const cursor = update.state.selection.main.head;
            const line = update.state.doc.lineAt(cursor);
            onactiveline?.(line.text, line.number, update.state.doc.lines, cursor - line.from + 1);
          }
        }),
      ],
    });

    view = new EditorView({
      state,
      parent: containerEl,
    });
    view.focus();

    // Listen to vim mode changes + poll key buffer on keydown
    function setupVimListeners(getCMFn: (v: any) => any) {
      cleanupVimPoller?.();
      const cm = getCMFn(view);
      if (!cm) return;

      // Use the CM event system for reliable mode change detection
      const modeHandler = (e: { mode: string; subMode?: string }) => {
        const mode = e.mode === "visual" && e.subMode
          ? `visual ${e.subMode}` // "visual line", "visual block"
          : e.mode;
        onvimmodechange?.(mode);
      };
      cm.on("vim-mode-change", modeHandler);

      // Poll key buffer on keydown (no event API for this)
      let lastStatus = "";
      const keyHandler = () => {
        setTimeout(() => {
          const vim = cm.state?.vim;
          if (!vim) return;
          const status = vim.status || "";
          if (status !== lastStatus) {
            lastStatus = status;
            onvimkeybuffer?.(status);
          }
        }, 0);
      };
      const el = containerEl!;
      el.addEventListener("keydown", keyHandler);

      cleanupVimPoller = () => {
        cm.off("vim-mode-change", modeHandler);
        el.removeEventListener("keydown", keyHandler);
      };
    }

    // Set up vim listeners after view creation (getCM needs vim attached)
    if (vimEnabled && vimExtension.length !== 0) {
      const { getCM } = await import("@replit/codemirror-vim");
      setupVimListeners(getCM);
      onvimmodechange?.("normal");
    }

    // Register ex commands once globally + wire relative line numbers
    if (VimApi && !vimExRegistered) {
      const { relativeLineNumbers } = await import("../services/relative-line-numbers");
      VimApi.defineEx("write", "w", () => activeVimCommandHandler?.("write"));
      VimApi.defineEx("quit", "q", () => activeVimCommandHandler?.("quit"));
      VimApi.defineEx("wquit", "wq", () => {
        activeVimCommandHandler?.("write");
        activeVimCommandHandler?.("quit");
      });
      VimApi.defineEx("xit", "x", () => {
        activeVimCommandHandler?.("write");
        activeVimCommandHandler?.("quit");
      });
      VimApi.defineOption("relativenumber", false, "boolean", ["rnu"], (value: boolean) => {
        if (!view) return;
        if (value) {
          view.dom.classList.add("cm-relative-lines");
          view.dispatch({ effects: relLineCompartment.reconfigure(relativeLineNumbers()) });
        } else {
          view.dom.classList.remove("cm-relative-lines");
          view.dispatch({ effects: relLineCompartment.reconfigure([]) });
        }
      });
      vimExRegistered = true;
    }
    activeVimCommandHandler = (cmd) => onvimcommand?.(cmd);

    // Expose reconfigure callbacks for $effect blocks
    reconfigureTheme = (t: ThemeType) => {
      if (!view) return;
      view.dispatch({
        effects: themeCompartment.reconfigure(getThemeExtension(t)),
      });
    };

    reconfigureLineWrap = (wrap: boolean) => {
      if (!view) return;
      view.dispatch({
        effects: lineWrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
      });
    };

    reconfigureFontSize = (zoom: number) => {
      if (!view) return;
      view.dispatch({
        effects: fontSizeCompartment.reconfigure(getFontSizeExtension(zoom)),
      });
    };

    reconfigureVim = async (enabled: boolean) => {
      if (!view) return;
      if (enabled) {
        try {
          const { vim, getCM } = await import("@replit/codemirror-vim");
          view.dispatch({ effects: vimCompartment.reconfigure(vim()) });
          setupVimListeners(getCM);
          onvimmodechange?.("normal");
        } catch {
          // vim module failed to load
        }
      } else {
        cleanupVimPoller?.();
        cleanupVimPoller = null;
        view.dispatch({ effects: vimCompartment.reconfigure([]) });
        onvimmodechange?.("");
        onvimkeybuffer?.("");
      }
    };

    dispatchSearchHighlight = (text: string, _key: number, _content: string) => {
      if (!view) return;
      const effects: any[] = [setSearchText.of(text)];

      if (text.trim()) {
        const trimmed = text.trim();
        const doc = view.state.doc;
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const idx = line.text.indexOf(trimmed);
          if (idx !== -1) {
            effects.push(EditorView.scrollIntoView(line.from + idx, { y: "center" }));
            break;
          }
        }
      }

      view.dispatch({ effects });
    };
    } catch {
      // Editor failed to initialize (e.g. module loading issue)
    }
  });

  // Reconfigure theme when it changes
  $effect(() => {
    const t = theme;
    reconfigureTheme?.(t);
  });

  // Reconfigure line wrapping when it changes
  $effect(() => {
    const wrap = lineWrapping;
    reconfigureLineWrap?.(wrap);
  });

  // Reconfigure font size when zoom changes
  $effect(() => {
    const zoom = zoomLevel;
    reconfigureFontSize?.(zoom);
  });

  // Reconfigure vim when it changes (skip first run — onMount already set it up)
  let vimInitialized = false;
  $effect(() => {
    const enabled = vimEnabled;
    if (!vimInitialized) { vimInitialized = true; return; }
    reconfigureVim?.(enabled);
  });

  // If the content prop changes externally (e.g. initial load timing), sync the editor
  $effect(() => {
    if (!view?.state?.doc) return;
    const currentDoc = view.state.doc.toString();
    if (content !== currentDoc) {
      suppressNextChange = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  });

  // When search highlight text changes, update CodeMirror decorations and scroll to match
  $effect(() => {
    const text = highlightText;
    const _key = highlightKey;
    const _content = content;
    dispatchSearchHighlight?.(text, _key, _content);
  });

  onDestroy(() => {
    cleanupVimPoller?.();
    activeVimCommandHandler = null;
    view?.destroy();
  });
</script>

<div class="markdown-editor" bind:this={containerEl}></div>

<style>
  .markdown-editor {
    height: 100%;
    overflow: hidden;
  }

  .markdown-editor :global(.cm-editor) {
    height: 100%;
  }

  /* Hide default line numbers when relative line numbers are active */
  .markdown-editor :global(.cm-relative-lines .cm-lineNumbers) {
    display: none;
  }

  .markdown-editor :global(.cm-relativeLineNumbers) {
    min-width: 32px;
    text-align: right;
  }

  .markdown-editor :global(.cm-relativeLineNumbers .cm-gutterElement) {
    padding: 0 4px 0 8px;
  }
</style>
