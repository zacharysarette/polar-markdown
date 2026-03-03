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

import { renderMarkdown, renderMermaidDiagrams, getDirectory, resolveImageSrc, slugify, resolvePath } from "./markdown";
import mermaid from "mermaid";

describe("renderMarkdown", () => {
  it("renders basic markdown headings", async () => {
    const html = await renderMarkdown("# Hello World");
    expect(html).toContain("<h1");
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

describe("renderMarkdown tables", () => {
  it("wraps tables in a scrollable container", async () => {
    const md = "| Col A | Col B |\n|-------|-------|\n| 1 | 2 |";
    const html = await renderMarkdown(md);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const wrapper = doc.querySelector(".table-wrapper");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.querySelector("table")).not.toBeNull();
  });

  it("renders table cell content correctly (not [object Object])", async () => {
    const md = "| Col A | Col B |\n|-------|-------|\n| hello | world |";
    const html = await renderMarkdown(md);
    expect(html).toContain("<th>Col A</th>");
    expect(html).toContain("<td>hello</td>");
    expect(html).not.toContain("[object Object]");
  });

  it("table wrapper has the correct class", async () => {
    const md = "| Col A | Col B |\n|-------|-------|\n| 1 | 2 |";
    const html = await renderMarkdown(md);
    expect(html).toContain('class="table-wrapper"');
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

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello")).toBe("hello");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("What's New?")).toBe("whats-new");
  });

  it("preserves hyphens and underscores", () => {
    expect(slugify("my-slug_name")).toBe("my-slug_name");
  });

  it("handles numbers", () => {
    expect(slugify("Section 2")).toBe("section-2");
  });

  it("strips leading/trailing whitespace", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("collapses multiple spaces into single hyphen", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  it("strips inline bold markers", () => {
    expect(slugify("**bold text**")).toBe("bold-text");
  });

  it("strips inline link syntax", () => {
    expect(slugify("[text](url)")).toBe("text");
  });

  it("strips inline code backticks", () => {
    expect(slugify("`code` stuff")).toBe("code-stuff");
  });

  it("strips inline italic markers", () => {
    expect(slugify("*italic text*")).toBe("italic-text");
  });
});

describe("renderMarkdown heading IDs", () => {
  it("adds id attribute to h1", async () => {
    const html = await renderMarkdown("# Hello");
    expect(html).toContain('<h1 id="hello">');
  });

  it("adds id attribute to h2 with multi-word text", async () => {
    const html = await renderMarkdown("## Hello World");
    expect(html).toContain('<h2 id="hello-world">');
  });

  it("suffixes duplicate heading IDs", async () => {
    const html = await renderMarkdown("## Foo\n\n## Foo");
    expect(html).toContain('id="foo"');
    expect(html).toContain('id="foo-1"');
  });

  it("suffixes triple duplicate heading IDs", async () => {
    const html = await renderMarkdown("## Foo\n\n## Foo\n\n## Foo");
    expect(html).toContain('id="foo"');
    expect(html).toContain('id="foo-1"');
    expect(html).toContain('id="foo-2"');
  });

  it("resets slug counter between renderMarkdown calls", async () => {
    await renderMarkdown("## Foo\n\n## Foo");
    const html = await renderMarkdown("## Foo");
    // Should be just "foo" — no suffix — because counter reset
    expect(html).toContain('id="foo"');
    expect(html).not.toContain('id="foo-1"');
  });

  it("strips inline formatting from id but preserves in HTML", async () => {
    const html = await renderMarkdown("## Hello **World**");
    expect(html).toContain('id="hello-world"');
    expect(html).toContain("World");
  });
});

describe("resolvePath", () => {
  it("resolves simple relative path", () => {
    expect(resolvePath("/home/docs", "notes.md")).toBe("/home/docs/notes.md");
  });

  it("resolves .. parent references", () => {
    expect(resolvePath("/home/docs", "../sibling/file.md")).toBe("/home/sibling/file.md");
  });

  it("resolves ./ current directory", () => {
    expect(resolvePath("/home/docs", "./readme.md")).toBe("/home/docs/readme.md");
  });

  it("handles Windows backslash paths", () => {
    expect(resolvePath("C:\\Users\\docs", "notes.md")).toBe("C:/Users/docs/notes.md");
  });

  it("preserves leading slash for Unix paths", () => {
    const result = resolvePath("/usr/share/docs", "file.md");
    expect(result.startsWith("/")).toBe(true);
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
