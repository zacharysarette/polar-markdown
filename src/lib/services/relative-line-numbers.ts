import { gutter, GutterMarker } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

class RelativeLineMarker extends GutterMarker {
  constructor(readonly label: string) {
    super();
  }
  toDOM() {
    const el = document.createElement("span");
    el.textContent = this.label;
    return el;
  }
}

export function relativeLineNumbers() {
  return gutter({
    class: "cm-relativeLineNumbers",
    lineMarker(view: EditorView, line) {
      const cursorLine = view.state.doc.lineAt(
        view.state.selection.main.head
      ).number;
      const lineNumber = view.state.doc.lineAt(line.from).number;
      const rel = Math.abs(lineNumber - cursorLine);
      // Show absolute number for cursor line, relative for others
      const label = rel === 0 ? String(lineNumber) : String(rel);
      return new RelativeLineMarker(label);
    },
    lineMarkerChange(update) {
      return update.selectionSet || update.docChanged;
    },
  });
}
