export interface FixResult {
  content: string;
  fixes: number;
}

export interface MarkdownFixResult {
  result: string;
  totalFixes: number;
}

const NON_GRAPH_TYPES = [
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "quadrantChart",
  "requirementDiagram",
  "gitGraph",
  "mindmap",
  "timeline",
  "zenuml",
  "sankey-beta",
  "xychart-beta",
  "block-beta",
];

export function fixMermaidBlock(text: string): FixResult {
  if (!text.trim()) return { content: text, fixes: 0 };

  let content = text.replace(/\r\n/g, "\n");
  let fixes = 0;

  const firstLine = content.split("\n")[0].trim();

  // If it's a non-graph diagram type, return unchanged
  for (const type of NON_GRAPH_TYPES) {
    if (firstLine.startsWith(type)) {
      return { content, fixes: 0 };
    }
  }

  // Fix 1: Missing direction on bare graph/flowchart keyword
  const bareKeyword = content.match(/^(graph|flowchart)\s*$/m);
  if (bareKeyword) {
    content = content.replace(/^(graph|flowchart)\s*$/m, "$1 TD");
    fixes++;
  }

  // Fix 2: Missing diagram type — if first line has no known keyword
  const firstLineAfterFix = content.split("\n")[0].trim();
  const hasType = /^(graph|flowchart)\s/i.test(firstLineAfterFix);
  if (!hasType) {
    content = "graph TD\n" + content;
    fixes++;
  }

  // Fix 3: Single-dash arrows -> to -->
  // Match -> that is NOT preceded by - (not -->) and NOT followed by > (not ->>)
  const arrowFixed = content.replace(/(?<!-)->(?!>)/g, "-->");
  const arrowDiff = (arrowFixed.match(/-->/g) || []).length - (content.match(/-->/g) || []).length;
  if (arrowDiff > 0) {
    fixes += arrowDiff;
    content = arrowFixed;
  }

  // Fix 4: Unclosed subgraphs — count subgraph vs end lines
  const lines = content.split("\n");
  let subgraphCount = 0;
  let endCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^subgraph\b/.test(trimmed)) subgraphCount++;
    if (trimmed === "end") endCount++;
  }
  const missingEnds = subgraphCount - endCount;
  if (missingEnds > 0) {
    content += "\n" + Array(missingEnds).fill("end").join("\n");
    fixes += missingEnds;
  }

  return { content, fixes };
}

export function fixMermaidInMarkdown(markdown: string): MarkdownFixResult {
  let totalFixes = 0;
  const normalized = markdown.replace(/\r\n/g, "\n");

  const result = normalized.replace(/```mermaid\n([\s\S]*?)```/g, (_match, block: string) => {
    const fixed = fixMermaidBlock(block.trimEnd());
    totalFixes += fixed.fixes;
    return "```mermaid\n" + fixed.content + "\n```";
  });

  return { result, totalFixes };
}
