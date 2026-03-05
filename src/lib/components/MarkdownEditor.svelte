<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
  import { EditorState, StateField, StateEffect, Compartment } from "@codemirror/state";
  import { markdown } from "@codemirror/lang-markdown";
  import { basicSetup } from "codemirror";
  import { auroraTheme, glacierTheme } from "../services/codemirror-themes";
  import { mermaidLinter, lintGutter } from "../services/mermaid-linter";
  import type { ThemeType } from "../types";

  let {
    content = "",
    onchange,
    highlightText = "",
    highlightKey = 0,
    onactiveline,
    theme = "aurora" as ThemeType,
  }: {
    content?: string;
    onchange?: (content: string) => void;
    highlightText?: string;
    highlightKey?: number;
    onactiveline?: (lineContent: string, lineNumber: number, totalLines: number, column: number) => void;
    theme?: ThemeType;
  } = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined;
  let suppressNextChange = false;
  const themeCompartment = new Compartment();

  function getThemeExtension(t: ThemeType) {
    return t === "aurora" ? auroraTheme : glacierTheme;
  }

  // Search highlight via CodeMirror decorations
  const setSearchText = StateEffect.define<string>();
  const searchMark = Decoration.mark({ class: "cm-search-highlight" });

  function computeSearchDecorations(state: EditorState, text: string): DecorationSet {
    if (!text.trim()) return Decoration.none;
    const trimmed = text.trim();
    const ranges: ReturnType<typeof searchMark.range>[] = [];
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

  const searchHighlightField = StateField.define<{ text: string; decorations: DecorationSet }>({
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
    provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
  });

  onMount(() => {
    if (!containerEl) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        themeCompartment.of(getThemeExtension(theme)),
        searchHighlightField,
        mermaidLinter,
        lintGutter(),
        EditorView.theme({
          "&": { height: "100%", fontSize: "14px" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            if (suppressNextChange) {
              suppressNextChange = false;
              return;
            }
            onchange?.(update.state.doc.toString());
          }
          // Emit active line content, number, total, and column on cursor movement or doc change
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

  });

  // Reconfigure theme when it changes
  $effect(() => {
    if (!view) return;
    const ext = getThemeExtension(theme);
    view.dispatch({
      effects: themeCompartment.reconfigure(ext),
    });
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
  // NOTE: `content` is tracked so that when a new file loads (content changes)
  // while highlightText is already set, the search re-fires and scrolls to the match.
  $effect(() => {
    if (!view) return;
    const text = highlightText;
    const _key = highlightKey;
    const _content = content;

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
