import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

// Aurora (dark) theme
const auroraEditorTheme = EditorView.theme(
  {
    "&": {
      color: "#c0caf5",
      backgroundColor: "#1a1b26",
    },
    ".cm-content": {
      caretColor: "#7aa2f7",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#7aa2f7",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(122, 162, 247, 0.2)",
      },
    ".cm-panels": {
      backgroundColor: "#1e1f2e",
      color: "#c0caf5",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid #2f3146",
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: "1px solid #2f3146",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(224, 175, 104, 0.3)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(224, 175, 104, 0.5)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(122, 162, 247, 0.08)",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(122, 162, 247, 0.15)",
    },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "rgba(122, 162, 247, 0.25)",
    },
    ".cm-gutters": {
      backgroundColor: "#1a1b26",
      color: "#565f89",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(122, 162, 247, 0.08)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "#565f89",
    },
    ".cm-tooltip": {
      border: "1px solid #2f3146",
      backgroundColor: "#1e1f2e",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: "#1e1f2e",
      borderBottomColor: "#1e1f2e",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(122, 162, 247, 0.15)",
        color: "#c0caf5",
      },
    },
    ".cm-search-highlight": {
      backgroundColor: "rgba(224, 175, 104, 0.35)",
      borderRadius: "2px",
    },
    ".cm-lint-marker-error": {
      content: "'!'",
      color: "#f7768e",
    },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "wavy underline #f7768e",
      textUnderlineOffset: "3px",
    },
    ".cm-tooltip-lint": {
      backgroundColor: "#1e1f2e",
      border: "1px solid #2f3146",
      color: "#c0caf5",
    },
    ".cm-search label": {
      color: "#c0caf5",
    },
    ".cm-search input, .cm-search button": {
      background: "#1a1b26",
      color: "#c0caf5",
      border: "1px solid #2f3146",
      borderRadius: "3px",
      padding: "2px 6px",
    },
    ".cm-search button:hover": {
      background: "#24253a",
    },
    ".cm-search input:focus": {
      borderColor: "#7aa2f7",
      outline: "none",
    },
    ".cm-search br": {
      display: "none",
    },
    ".cm-search [name=close]": {
      color: "#565f89",
    },
    ".cm-search [name=close]:hover": {
      color: "#c0caf5",
    },
  },
  { dark: true }
);

const auroraHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#bb9af7" },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: "#c0caf5" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#7aa2f7" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#e0af68" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#c0caf5" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#e0af68" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: "#7dcfff" },
  { tag: [tags.meta, tags.comment], color: "#565f89" },
  { tag: tags.strong, fontWeight: "bold", color: "#e0af68" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#bb9af7" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#7dcfff", textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "#7aa2f7" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#e0af68" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#9ece6a" },
  { tag: tags.invalid, color: "#f7768e" },
]);

export const auroraTheme: Extension = [
  auroraEditorTheme,
  syntaxHighlighting(auroraHighlightStyle),
];

// Glacier (light) theme
const glacierEditorTheme = EditorView.theme(
  {
    "&": {
      color: "#2e3440",
      backgroundColor: "#f4f7fb",
    },
    ".cm-content": {
      caretColor: "#4a8dbf",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#4a8dbf",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(74, 141, 191, 0.2)",
      },
    ".cm-panels": {
      backgroundColor: "#e8eef5",
      color: "#2e3440",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid #c0cdd8",
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: "1px solid #c0cdd8",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(196, 144, 48, 0.3)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(196, 144, 48, 0.5)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(74, 141, 191, 0.08)",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(74, 141, 191, 0.15)",
    },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "rgba(74, 141, 191, 0.25)",
    },
    ".cm-gutters": {
      backgroundColor: "#f4f7fb",
      color: "#6b7d8e",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(74, 141, 191, 0.08)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "#6b7d8e",
    },
    ".cm-tooltip": {
      border: "1px solid #c0cdd8",
      backgroundColor: "#e8eef5",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: "#e8eef5",
      borderBottomColor: "#e8eef5",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(74, 141, 191, 0.15)",
        color: "#2e3440",
      },
    },
    ".cm-search-highlight": {
      backgroundColor: "rgba(196, 144, 48, 0.35)",
      borderRadius: "2px",
    },
    ".cm-lint-marker-error": {
      content: "'!'",
      color: "#b94e5a",
    },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "wavy underline #b94e5a",
      textUnderlineOffset: "3px",
    },
    ".cm-tooltip-lint": {
      backgroundColor: "#e8eef5",
      border: "1px solid #c0cdd8",
      color: "#2e3440",
    },
    ".cm-search label": {
      color: "#2e3440",
    },
    ".cm-search input, .cm-search button": {
      background: "#ffffff",
      color: "#2e3440",
      border: "1px solid #c0cdd8",
      borderRadius: "3px",
      padding: "2px 6px",
    },
    ".cm-search button:hover": {
      background: "#dce4ed",
    },
    ".cm-search input:focus": {
      borderColor: "#4a8dbf",
      outline: "none",
    },
    ".cm-search br": {
      display: "none",
    },
    ".cm-search [name=close]": {
      color: "#6b7d8e",
    },
    ".cm-search [name=close]:hover": {
      color: "#2e3440",
    },
  },
  { dark: false }
);

const glacierHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#8b6f9e" },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: "#2e3440" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#4a8dbf" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#c49030" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#2e3440" },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: "#c49030" },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: "#4a8dbf" },
  { tag: [tags.meta, tags.comment], color: "#6b7d8e" },
  { tag: tags.strong, fontWeight: "bold", color: "#c49030" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#8b6f9e" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#4a8dbf", textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "#4a8dbf" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#c49030" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#5a9e6f" },
  { tag: tags.invalid, color: "#b94e5a" },
]);

export const glacierTheme: Extension = [
  glacierEditorTheme,
  syntaxHighlighting(glacierHighlightStyle),
];
