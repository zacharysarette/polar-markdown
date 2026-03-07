import { describe, it, expect } from "vitest";
import { fixMermaidBlock, fixMermaidInMarkdown } from "./mermaid-fixer";

describe("fixMermaidBlock", () => {
  it("returns unchanged for valid graph", () => {
    const input = "graph TD\n  A --> B";
    const result = fixMermaidBlock(input);
    expect(result.fixes).toBe(0);
    expect(result.content).toBe(input);
  });

  it("returns unchanged for non-graph diagram types", () => {
    const input = "sequenceDiagram\n  Alice->>Bob: Hello";
    expect(fixMermaidBlock(input).fixes).toBe(0);
    expect(fixMermaidBlock(input).content).toBe(input);
  });

  it("skips classDiagram", () => {
    const input = "classDiagram\n  Animal <|-- Dog";
    expect(fixMermaidBlock(input).fixes).toBe(0);
  });

  it("skips stateDiagram", () => {
    const input = "stateDiagram-v2\n  [*] --> Still";
    expect(fixMermaidBlock(input).fixes).toBe(0);
  });

  it("skips pie chart", () => {
    const input = 'pie title Pets\n  "Dogs" : 386';
    expect(fixMermaidBlock(input).fixes).toBe(0);
  });

  it("prepends graph TD when diagram type is missing", () => {
    const input = "A --> B\nB --> C";
    const result = fixMermaidBlock(input);
    expect(result.content).toContain("graph TD");
    expect(result.fixes).toBeGreaterThan(0);
  });

  it("adds direction to bare graph keyword", () => {
    const input = "graph\n  A --> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toMatch(/^graph TD/);
    expect(result.fixes).toBe(1);
  });

  it("adds direction to bare flowchart keyword", () => {
    const input = "flowchart\n  A --> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toMatch(/^flowchart TD/);
    expect(result.fixes).toBe(1);
  });

  it("fixes single-dash arrows to double-dash", () => {
    const input = "graph TD\n  A -> B\n  C -> D";
    const result = fixMermaidBlock(input);
    expect(result.content).toBe("graph TD\n  A --> B\n  C --> D");
    expect(result.fixes).toBe(2);
  });

  it("does not break existing double-dash arrows", () => {
    const input = "graph TD\n  A --> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toBe(input);
    expect(result.fixes).toBe(0);
  });

  it("does not break ->> arrows in sequence diagrams", () => {
    // This would be skipped anyway since it's sequenceDiagram, but test the regex
    const input = "graph TD\n  A ->> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toBe("graph TD\n  A ->> B");
  });

  it("appends missing end for unclosed subgraphs", () => {
    const input = "graph TD\n  subgraph SG\n    A --> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toBe("graph TD\n  subgraph SG\n    A --> B\nend");
    expect(result.fixes).toBe(1);
  });

  it("appends multiple missing ends for multiple unclosed subgraphs", () => {
    const input = "graph TD\n  subgraph A\n    subgraph B\n      X --> Y";
    const result = fixMermaidBlock(input);
    expect(result.content).toContain("end\nend");
    expect(result.fixes).toBe(2);
  });

  it("handles combined issues: missing type + single arrows + unclosed subgraph", () => {
    const input = "subgraph S\n  A -> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toContain("graph TD");
    expect(result.content).toContain("-->");
    expect(result.content).toContain("end");
    expect(result.fixes).toBeGreaterThanOrEqual(3);
  });

  it("returns empty content unchanged", () => {
    const result = fixMermaidBlock("");
    expect(result.fixes).toBe(0);
    expect(result.content).toBe("");
  });

  it("fixes single-dash arrows with \\r\\n line endings", () => {
    const input = "graph TD\r\n  A -> B";
    const result = fixMermaidBlock(input);
    expect(result.fixes).toBe(1);
    expect(result.content).toContain("-->");
  });

  it("adds direction to bare graph with \\r\\n line endings", () => {
    const input = "graph\r\n  A --> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toMatch(/^graph TD/);
    expect(result.fixes).toBe(1);
  });

  it("appends end for unclosed subgraph with \\r\\n line endings", () => {
    const input = "graph TD\r\n  subgraph SG\r\n    A --> B";
    const result = fixMermaidBlock(input);
    expect(result.content).toContain("end");
    expect(result.fixes).toBe(1);
  });
});

describe("fixMermaidInMarkdown", () => {
  it("fixes mermaid blocks in full markdown", () => {
    const md = "# Title\n\nSome text.\n\n```mermaid\nA -> B\n```\n\nMore text.";
    const result = fixMermaidInMarkdown(md);
    expect(result.totalFixes).toBeGreaterThan(0);
    expect(result.result).toContain("graph TD");
    expect(result.result).toContain("-->");
  });

  it("leaves non-mermaid code blocks alone", () => {
    const md = "```javascript\nconst x = 1;\n```";
    const result = fixMermaidInMarkdown(md);
    expect(result.totalFixes).toBe(0);
    expect(result.result).toBe(md);
  });

  it("fixes multiple mermaid blocks", () => {
    const md = "```mermaid\nA -> B\n```\n\n```mermaid\nC -> D\n```";
    const result = fixMermaidInMarkdown(md);
    expect(result.totalFixes).toBeGreaterThan(0);
    // Both blocks should be fixed
    const arrows = result.result.match(/-->/g);
    expect(arrows).not.toBeNull();
    expect(arrows!.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty doc unchanged", () => {
    const result = fixMermaidInMarkdown("");
    expect(result.totalFixes).toBe(0);
    expect(result.result).toBe("");
  });

  it("returns doc with valid mermaid unchanged", () => {
    const md = "```mermaid\ngraph TD\n  A --> B\n```";
    const result = fixMermaidInMarkdown(md);
    expect(result.totalFixes).toBe(0);
    expect(result.result).toBe(md);
  });

  it("matches and fixes mermaid blocks with \\r\\n line endings", () => {
    const md = "```mermaid\r\nA -> B\r\n```";
    const result = fixMermaidInMarkdown(md);
    expect(result.totalFixes).toBeGreaterThan(0);
    expect(result.result).toContain("graph TD");
    expect(result.result).toContain("-->");
  });

  it("fixes multiple mermaid blocks with \\r\\n line endings", () => {
    const md = "```mermaid\r\nA -> B\r\n```\r\n\r\n```mermaid\r\nC -> D\r\n```";
    const result = fixMermaidInMarkdown(md);
    expect(result.totalFixes).toBeGreaterThan(0);
    const arrows = result.result.match(/-->/g);
    expect(arrows!.length).toBeGreaterThanOrEqual(2);
  });

  it("handles mixed \\r\\n and \\n line endings", () => {
    const md = "```mermaid\r\nA -> B\n```\n\n```mermaid\nC -> D\r\n```";
    const result = fixMermaidInMarkdown(md);
    expect(result.totalFixes).toBeGreaterThan(0);
    const arrows = result.result.match(/-->/g);
    expect(arrows!.length).toBeGreaterThanOrEqual(2);
  });
});
