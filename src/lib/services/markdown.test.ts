import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mermaid before importing the module
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(),
    parse: vi.fn(),
    render: vi.fn(),
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

import { renderMarkdown, renderMermaidDiagrams, validateMermaidBlocks, getDirectory, resolveImageSrc, slugify, resolvePath } from "./markdown";
import type { MermaidDiagnostic } from "./markdown";
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

  it("renders file links without spaces", async () => {
    const html = await renderMarkdown("[Museum](test.md)");
    expect(html).toContain("<a");
    expect(html).toContain("test.md");
  });

  it("does not render links with spaces in URL", async () => {
    const html = await renderMarkdown("[Guide](How to Use Glacimark.md)");
    expect(html).not.toContain("<a");
    expect(html).toContain("[Guide](How to Use Glacimark.md)");
  });

  it("renders links with angle-bracket URLs containing spaces", async () => {
    const html = await renderMarkdown("[Guide](<How to Use Glacimark.md>)");
    expect(html).toContain("<a");
    expect(html).toContain("How%20to%20Use%20Glacimark.md");
  });

  it("renders links with percent-encoded spaces in URL", async () => {
    const html = await renderMarkdown("[Guide](How%20to%20Use%20Glacimark.md)");
    expect(html).toContain("<a");
    expect(html).toContain("How%20to%20Use%20Glacimark.md");
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
    vi.mocked(mermaid.parse).mockReset();
    vi.mocked(mermaid.render).mockReset();
    document.body.innerHTML = "";
  });

  it("returns result with total and errorCount fields", async () => {
    document.body.innerHTML = '<pre class="mermaid">flowchart TD\n    A-->B</pre>';
    vi.mocked(mermaid.parse).mockResolvedValue(true as any);
    vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg></svg>', bindFunctions: vi.fn() } as any);

    const result = await renderMermaidDiagrams();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("errorCount");
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

describe("validateMermaidBlocks", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.mocked(mermaid.parse).mockReset();
  });

  it("returns empty array when all blocks are valid", async () => {
    document.body.innerHTML = '<pre class="mermaid">flowchart TD\n    A-->B</pre>';
    vi.mocked(mermaid.parse).mockResolvedValue(true as any);

    const diagnostics = await validateMermaidBlocks();
    expect(diagnostics).toEqual([]);
  });

  it("returns diagnostics for invalid syntax", async () => {
    document.body.innerHTML = '<pre class="mermaid">not valid mermaid</pre>';
    vi.mocked(mermaid.parse).mockRejectedValue(new Error("Parse error on line 1"));

    const diagnostics = await validateMermaidBlocks();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].blockIndex).toBe(0);
    expect(diagnostics[0].error).toContain("Parse error");
  });

  it("includes error message from mermaid", async () => {
    document.body.innerHTML = '<pre class="mermaid">graph XY\n  bad syntax</pre>';
    vi.mocked(mermaid.parse).mockRejectedValue(new Error("Diagram type not found: XY"));

    const diagnostics = await validateMermaidBlocks();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].error).toBe("Diagram type not found: XY");
  });

  it("handles multiple blocks (some valid, some not)", async () => {
    document.body.innerHTML =
      '<pre class="mermaid">flowchart TD\n    A-->B</pre>' +
      '<pre class="mermaid">invalid stuff</pre>' +
      '<pre class="mermaid">sequenceDiagram\n    A->>B: Hi</pre>';
    vi.mocked(mermaid.parse)
      .mockResolvedValueOnce(true as any)
      .mockRejectedValueOnce(new Error("Parse error"))
      .mockResolvedValueOnce(true as any);

    const diagnostics = await validateMermaidBlocks();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].blockIndex).toBe(1);
  });

  it("handles empty blocks gracefully", async () => {
    document.body.innerHTML = '<pre class="mermaid"></pre>';
    vi.mocked(mermaid.parse).mockRejectedValue(new Error("No diagram definition"));

    const diagnostics = await validateMermaidBlocks();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].blockIndex).toBe(0);
  });
});

describe("renderMermaidDiagrams per-block error handling", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.mocked(mermaid.parse).mockReset();
    vi.mocked(mermaid.render).mockReset();
  });

  it("injects error overlay on invalid blocks", async () => {
    document.body.innerHTML = '<pre class="mermaid">bad diagram</pre>';
    vi.mocked(mermaid.parse).mockRejectedValue(new Error("Parse error on line 1"));

    const result = await renderMermaidDiagrams();

    const errorDiv = document.querySelector(".mermaid-error");
    expect(errorDiv).not.toBeNull();
    expect(errorDiv!.textContent).toContain("Parse error");
  });

  it("renders valid blocks normally", async () => {
    document.body.innerHTML = '<pre class="mermaid">flowchart TD\n    A-->B</pre>';
    vi.mocked(mermaid.parse).mockResolvedValue(true as any);
    vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg>rendered</svg>', bindFunctions: vi.fn() } as any);

    const result = await renderMermaidDiagrams();

    const pre = document.querySelector("pre.mermaid");
    expect(pre!.innerHTML).toContain("<svg>rendered</svg>");
    expect(document.querySelector(".mermaid-error")).toBeNull();
  });

  it("returns result with total and errorCount", async () => {
    document.body.innerHTML =
      '<pre class="mermaid">flowchart TD\n    A-->B</pre>' +
      '<pre class="mermaid">bad</pre>';
    vi.mocked(mermaid.parse)
      .mockResolvedValueOnce(true as any)
      .mockRejectedValueOnce(new Error("Parse error"));
    vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg></svg>', bindFunctions: vi.fn() } as any);

    const result = await renderMermaidDiagrams();
    expect(result.total).toBe(2);
    expect(result.errorCount).toBe(1);
  });

  it("returns zero counts when no mermaid blocks exist", async () => {
    document.body.innerHTML = '<p>No diagrams here</p>';

    const result = await renderMermaidDiagrams();
    expect(result.total).toBe(0);
    expect(result.errorCount).toBe(0);
  });
});

describe("renderMarkdown source line numbers", () => {
  it("adds data-source-line to headings when enabled", async () => {
    const html = await renderMarkdown("# Hello\n\nWorld", undefined, { sourceLineNumbers: true });
    expect(html).toContain('data-source-line="1"');
  });

  it("adds data-source-line to paragraphs when enabled", async () => {
    const html = await renderMarkdown("# Title\n\nSome paragraph", undefined, { sourceLineNumbers: true });
    expect(html).toMatch(/data-source-line="3"/);
  });

  it("does NOT add data-source-line when disabled", async () => {
    const html = await renderMarkdown("# Hello\n\nWorld");
    expect(html).not.toContain("data-source-line");
  });

  it("does NOT add data-source-line when option is false", async () => {
    const html = await renderMarkdown("# Hello\n\nWorld", undefined, { sourceLineNumbers: false });
    expect(html).not.toContain("data-source-line");
  });

  it("adds data-source-line to code blocks", async () => {
    const md = "# Title\n\n```js\nconst x = 1;\n```";
    const html = await renderMarkdown(md, undefined, { sourceLineNumbers: true });
    expect(html).toMatch(/<pre[^>]*data-source-line="3"/);
  });

  it("adds data-source-line to blockquotes", async () => {
    const md = "Hello\n\n> Quote here";
    const html = await renderMarkdown(md, undefined, { sourceLineNumbers: true });
    expect(html).toMatch(/<blockquote[^>]*data-source-line="3"/);
  });

  it("adds data-source-line to lists", async () => {
    const md = "Hello\n\n- Item 1\n- Item 2";
    const html = await renderMarkdown(md, undefined, { sourceLineNumbers: true });
    expect(html).toMatch(/<ul[^>]*data-source-line="3"/);
  });

  it("adds data-source-line to tables", async () => {
    const md = "Hello\n\n| A | B |\n|---|---|\n| 1 | 2 |";
    const html = await renderMarkdown(md, undefined, { sourceLineNumbers: true });
    expect(html).toMatch(/<table[^>]*data-source-line="3"/);
  });

  it("adds data-source-line to hr", async () => {
    const md = "Hello\n\n---\n\nWorld";
    const html = await renderMarkdown(md, undefined, { sourceLineNumbers: true });
    expect(html).toMatch(/<hr[^>]*data-source-line="3"/);
  });

  it("tracks correct line numbers in multi-block documents", async () => {
    const md = "# Title\n\nParagraph one.\n\n## Second\n\nParagraph two.";
    const html = await renderMarkdown(md, undefined, { sourceLineNumbers: true });
    expect(html).toContain('data-source-line="1"');  // # Title
    expect(html).toContain('data-source-line="3"');  // Paragraph one
    expect(html).toContain('data-source-line="5"');  // ## Second
    expect(html).toContain('data-source-line="7"');  // Paragraph two
  });

  it("adds data-source-line to mermaid blocks", async () => {
    const md = "# Title\n\n```mermaid\nflowchart TD\n    A-->B\n```";
    const html = await renderMarkdown(md, undefined, { sourceLineNumbers: true });
    expect(html).toMatch(/<pre[^>]*class="mermaid"[^>]*data-source-line="3"/);
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

describe("wiki-style [[links]]", () => {
  it("renders basic [[filename]] as a wikilink", async () => {
    const html = await renderMarkdown("See [[notes]]");
    expect(html).toContain('class="wikilink"');
    expect(html).toContain("notes.md");
    expect(html).toContain(">notes<");
  });

  it("renders [[filename.md]] without doubling .md", async () => {
    const html = await renderMarkdown("See [[notes.md]]");
    expect(html).toContain("notes.md");
    expect(html).not.toContain("notes.md.md");
  });

  it("renders [[file|alias]] with display text", async () => {
    const html = await renderMarkdown("See [[notes|My Notes]]");
    expect(html).toContain(">My Notes<");
    expect(html).toContain("notes.md");
  });

  it("URL-encodes spaces in href", async () => {
    const html = await renderMarkdown("See [[my doc]]");
    expect(html).toContain("my%20doc.md");
  });

  it("does not parse [[links]] inside inline code", async () => {
    const html = await renderMarkdown("Use `[[link]]` syntax");
    expect(html).not.toContain("wikilink");
    expect(html).toContain("[[link]]");
  });

  it("does not parse [[links]] inside code blocks", async () => {
    const html = await renderMarkdown("```\n[[link]]\n```");
    expect(html).not.toContain("wikilink");
  });

  it("ignores empty [[]]", async () => {
    const html = await renderMarkdown("Empty [[]] here");
    expect(html).not.toContain("wikilink");
  });

  it("handles nested [[[bad]]] without crashing", async () => {
    const html = await renderMarkdown("Test [[[bad]]] here");
    expect(html).toBeDefined();
  });
});
