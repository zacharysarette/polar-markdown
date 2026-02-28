import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mermaid before importing the module
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(),
  },
}));

// Mock the filesystem service (renderAsciiDiagram calls Tauri invoke)
vi.mock("./filesystem", () => ({
  renderAsciiDiagram: vi.fn(),
}));

import { renderMarkdown, renderMermaidDiagrams } from "./markdown";
import mermaid from "mermaid";

describe("renderMarkdown", () => {
  it("renders basic markdown headings", async () => {
    const html = await renderMarkdown("# Hello World");
    expect(html).toContain("<h1>");
    expect(html).toContain("Hello World");
  });

  it("renders paragraphs", async () => {
    const html = await renderMarkdown("Some text here.");
    expect(html).toContain("<p>");
    expect(html).toContain("Some text here.");
  });

  it("renders mermaid code blocks as pre.mermaid", async () => {
    const md = '```mermaid\nflowchart TD\n    A-->B\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain("flowchart TD");
    // Should NOT wrap in <code> tag
    expect(html).not.toContain("<code");
  });

  it("renders bob code blocks as pre.bob", async () => {
    const md = '```bob\n+--+\n|  |\n+--+\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre class="bob">');
    expect(html).toContain("+--+");
    expect(html).not.toContain("<code");
  });

  it("renders svgbob code blocks as pre.bob", async () => {
    const md = '```svgbob\n+--+\n|  |\n+--+\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre class="bob">');
  });

  it("auto-detects unlabeled code blocks with box-drawing chars as bob", async () => {
    const md = '```\n┌──────┬──────┐\n│ Left │ Right│\n└──────┴──────┘\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre class="bob">');
    expect(html).not.toContain("<code");
  });

  it("auto-detects unlabeled code blocks with tree chars as bob", async () => {
    const md = '```\n├── src/\n│   └── main.rs\n└── Cargo.toml\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre class="bob">');
  });

  it("auto-detects unlabeled code blocks with arrow chars as bob", async () => {
    const md = '```\nA → B → C\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre class="bob">');
  });

  it("does NOT auto-detect regular unlabeled code as bob", async () => {
    const md = '```\nconst x = 42;\nconsole.log(x);\n```';
    const html = await renderMarkdown(md);
    expect(html).not.toContain('<pre class="bob">');
    expect(html).toContain("hljs");
    expect(html).toContain('pre class="line-numbers"');
  });

  it("syntax highlights known languages", async () => {
    const md = '```javascript\nconst x = 42;\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain("hljs");
    expect(html).toContain("language-javascript");
    expect(html).toContain('pre class="line-numbers"');
    expect(html).toContain("line-numbers-rows");
  });

  it("adds correct number of line number spans", async () => {
    const md = '```javascript\nline1\nline2\nline3\n```';
    const html = await renderMarkdown(md);
    const match = html.match(/<span class="line-numbers-rows" aria-hidden="true">((?:<span><\/span>)*)<\/span>/);
    expect(match).not.toBeNull();
    const spans = match![1].match(/<span><\/span>/g);
    expect(spans).toHaveLength(3);
  });

  it("line number rows are sibling of code under pre.line-numbers with matching count", async () => {
    const md = '```javascript\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```';
    const html = await renderMarkdown(md);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const pre = doc.querySelector("pre.line-numbers");
    expect(pre).not.toBeNull();
    const code = pre!.querySelector(":scope > code");
    const lineNumbersRows = pre!.querySelector(":scope > .line-numbers-rows");
    expect(code).not.toBeNull();
    expect(lineNumbersRows).not.toBeNull();
    const spans = lineNumbersRows!.querySelectorAll(":scope > span");
    expect(spans).toHaveLength(3);
  });

  it("renders inline code", async () => {
    const html = await renderMarkdown("Use `npm install` to install.");
    expect(html).toContain("<code>");
    expect(html).toContain("npm install");
  });

  it("renders links", async () => {
    const html = await renderMarkdown("[Click here](https://example.com)");
    expect(html).toContain("<a");
    expect(html).toContain("https://example.com");
  });

  it("renders lists", async () => {
    const html = await renderMarkdown("- Item 1\n- Item 2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
  });
});

describe("renderMermaidDiagrams", () => {
  beforeEach(() => {
    vi.mocked(mermaid.run).mockReset();
  });

  it("calls mermaid.run with correct selector", async () => {
    vi.mocked(mermaid.run).mockResolvedValue(undefined as any);

    await renderMermaidDiagrams();

    expect(mermaid.run).toHaveBeenCalledWith({
      querySelector: "pre.mermaid",
    });
  });
});
