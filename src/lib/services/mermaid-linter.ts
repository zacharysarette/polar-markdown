import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import mermaid from "mermaid";
import type { Extension } from "@codemirror/state";

export interface MermaidBlock {
  content: string;
  from: number;
  to: number;
}

/** Find all ```mermaid ... ``` blocks in a document string, returning content positions. */
export function findMermaidBlocks(doc: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(doc)) !== null) {
    const content = match[1].endsWith("\n")
      ? match[1].slice(0, -1)
      : match[1];
    const from = match.index + "```mermaid\n".length;
    const to = from + content.length;
    blocks.push({ content, from, to });
  }

  return blocks;
}

/** Lint mermaid blocks in a document string, returning diagnostics for invalid ones. */
export async function lintMermaidBlocks(doc: string): Promise<Diagnostic[]> {
  const blocks = findMermaidBlocks(doc);
  const diagnostics: Diagnostic[] = [];

  for (const block of blocks) {
    try {
      await mermaid.parse(block.content);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      diagnostics.push({
        from: block.from,
        to: block.to,
        severity: "error",
        message,
      });
    }
  }

  return diagnostics;
}

/** CodeMirror extension that lints mermaid blocks with red underlines. */
export const mermaidLinter: Extension = linter(
  async (view) => {
    const doc = view.state.doc.toString();
    return lintMermaidBlocks(doc);
  },
  { delay: 750 }
);

export { lintGutter };
