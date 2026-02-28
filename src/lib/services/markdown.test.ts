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

// Mock Tauri core for convertFileSrc
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `http://asset.localhost/${path.replace(/\\/g, "/")}`),
}));

import { renderMarkdown, renderMermaidDiagrams, getDirectory, resolveImageSrc } from "./markdown";
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

describe("getDirectory", () => {
  it("extracts directory from Unix path", () => {
    expect(getDirectory("/home/user/docs/readme.md")).toBe("/home/user/docs");
  });

  it("extracts directory from Windows path", () => {
    expect(getDirectory("C:\\Users\\test\\docs\\readme.md")).toBe("C:\\Users\\test\\docs");
  });

  it("returns empty string for bare filename", () => {
    expect(getDirectory("readme.md")).toBe("");
  });

  it("handles path with mixed separators", () => {
    expect(getDirectory("C:\\Users\\test/docs/readme.md")).toBe("C:\\Users\\test/docs");
  });
});

describe("resolveImageSrc", () => {
  it("passes through https URLs unchanged", () => {
    const url = "https://example.com/image.png";
    expect(resolveImageSrc(url, "/some/dir")).toBe(url);
  });

  it("passes through http URLs unchanged", () => {
    const url = "http://example.com/image.png";
    expect(resolveImageSrc(url, "/some/dir")).toBe(url);
  });

  it("passes through data URIs unchanged", () => {
    const dataUri = "data:image/png;base64,iVBOR...";
    expect(resolveImageSrc(dataUri, "/some/dir")).toBe(dataUri);
  });

  it("resolves relative path against markdown directory", () => {
    const result = resolveImageSrc("./img/photo.png", "/home/user/docs");
    expect(result).toBe("http://asset.localhost//home/user/docs/img/photo.png");
  });

  it("resolves parent directory references", () => {
    const result = resolveImageSrc("../sibling/image.jpg", "/home/user/docs");
    expect(result).toBe("http://asset.localhost//home/user/sibling/image.jpg");
  });

  it("resolves bare relative path (no ./)", () => {
    const result = resolveImageSrc("screenshot.png", "/home/user/docs");
    expect(result).toBe("http://asset.localhost//home/user/docs/screenshot.png");
  });
});

describe("renderMarkdown image integration", () => {
  it("renders external image URL unchanged", async () => {
    const html = await renderMarkdown("![alt](https://example.com/img.png)");
    expect(html).toContain("<img");
    expect(html).toContain('src="https://example.com/img.png"');
    expect(html).toContain('alt="alt"');
  });

  it("resolves relative image path when filePath provided", async () => {
    const html = await renderMarkdown("![photo](./img/photo.png)", "/home/user/docs/readme.md");
    expect(html).toContain("<img");
    expect(html).toContain("http://asset.localhost/");
    expect(html).toContain("img/photo.png");
  });

  it("includes title attribute when specified", async () => {
    const html = await renderMarkdown('![alt](https://example.com/img.png "My Title")');
    expect(html).toContain('title="My Title"');
  });

  it("adds lazy loading attribute", async () => {
    const html = await renderMarkdown("![alt](https://example.com/img.png)");
    expect(html).toContain('loading="lazy"');
  });

  it("adds onerror handler for broken images", async () => {
    const html = await renderMarkdown("![broken](./missing.png)", "/home/user/docs/readme.md");
    expect(html).toContain("onerror");
    expect(html).toContain("img-broken");
  });

  it("renders image without filePath using relative path as-is", async () => {
    const html = await renderMarkdown("![alt](./local.png)");
    expect(html).toContain("<img");
    expect(html).toContain('alt="alt"');
  });
});
