import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mermaid before importing the module
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(),
  },
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

  it("syntax highlights known languages", async () => {
    const md = '```javascript\nconst x = 42;\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain("hljs");
    expect(html).toContain("language-javascript");
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
