<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { ThemeType } from "../types";

  let {
    content = "",
    onchange,
    highlightText = "",
    highlightKey = 0,
    onactiveline,
    theme = "aurora" as ThemeType,
    lineWrapping = true,
  }: {
    content?: string;
    onchange?: (content: string) => void;
    highlightText?: string;
    highlightKey?: number;
    onactiveline?: (lineContent: string, lineNumber: number, totalLines: number, column: number) => void;
    theme?: ThemeType;
    lineWrapping?: boolean;
  } = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let view: any;
  let suppressNextChange = false;

  // These are set during onMount once CodeMirror is loaded
  let reconfigureTheme: ((t: ThemeType) => void) | null = null;
  let reconfigureLineWrap: ((wrap: boolean) => void) | null = null;
  let dispatchSearchHighlight: ((text: string, key: number, doc: string) => void) | null = null;

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

    // Search highlight via CodeMirror decorations
    const setSearchText = StateEffect.define<string>();
    const searchMark = Decoration.mark({ class: "cm-search-highlight" });

    function computeSearchDecorations(state: EditorState, text: string): any {
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
        searchHighlightField,
        mermaidLinter,
        lintGutter(),
        EditorView.theme({
          "&": { height: "100%", fontSize: "14px" },
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
</style>
