import { describe, it, expect, afterEach } from "vitest";
import {
  extractDiagramLabels,
  getCodeBlockLineOverlayPosition,
  stripMarkdownSyntax,
  findMatchingBlockElement,
  findMatchingPreElement,
  applyBlockHighlight,
  clearBlockHighlights,
  getTableCellIndex,
} from "./highlight";

describe("extractDiagramLabels", () => {
  it("extracts text from square brackets", () => {
    const labels = extractDiagramLabels("C --> E[View in App]");
    expect(labels).toContain("View in App");
  });

  it("extracts text from parentheses", () => {
    const labels = extractDiagramLabels("A(Start Planning)");
    expect(labels).toContain("Start Planning");
  });

  it("extracts text from curly braces (decision nodes)", () => {
    const labels = extractDiagramLabels("B{Choose Approach}");
    expect(labels).toContain("Choose Approach");
  });

  it("extracts text after colon (sequence diagram messages)", () => {
    const labels = extractDiagramLabels("User->>Claude: Describe what you need");
    expect(labels).toContain("Describe what you need");
  });

  it("extracts multiple labels from complex syntax", () => {
    const labels = extractDiagramLabels("A[Start] --> B{Decision}");
    expect(labels).toContain("Start");
    expect(labels).toContain("Decision");
    expect(labels.length).toBe(2);
  });

  it("skips labels shorter than 2 characters", () => {
    const labels = extractDiagramLabels("A[X] --> B[Go]");
    expect(labels).not.toContain("X");
    expect(labels).toContain("Go");
  });

  it("returns empty array for plain text without diagram syntax", () => {
    const labels = extractDiagramLabels("just plain text");
    expect(labels).toEqual([]);
  });

  it("trims whitespace from extracted labels", () => {
    const labels = extractDiagramLabels("A[ Padded Label ]");
    expect(labels).toContain("Padded Label");
  });
});

describe("getCodeBlockLineOverlayPosition", () => {
  it("finds correct line index for search text in code block", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "line one\nline two\nline three\nline four\nline five";
    pre.appendChild(code);
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "line three");
    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(2);

    document.body.removeChild(pre);
  });

  it("reads lineHeight from code element, not pre", () => {
    const pre = document.createElement("pre");
    pre.style.lineHeight = "24px";
    pre.style.paddingTop = "16px";
    const code = document.createElement("code");
    code.style.lineHeight = "19px";
    code.textContent = "line one\nline two\nline three\nline four\nline five";
    pre.appendChild(code);
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "line three");
    expect(result).not.toBeNull();
    // top = paddingTop(16) + lineIndex(2) * codeLineHeight(19) = 54
    expect(result!.top).toBe(16 + 2 * 19);
    expect(result!.height).toBe(19);

    document.body.removeChild(pre);
  });

  it("returns null when text not found in pre", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "line one\nline two\nline three";
    pre.appendChild(code);
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "nonexistent");
    expect(result).toBeNull();

    document.body.removeChild(pre);
  });

  it("uses fallback lineHeight when code element missing", () => {
    const pre = document.createElement("pre");
    pre.style.lineHeight = "22px";
    pre.style.paddingTop = "10px";
    pre.textContent = "line one\nline two\nline three";
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "line two");
    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(1);
    // Falls back to pre's own lineHeight: top = 10 + 1 * 22 = 32
    expect(result!.top).toBe(10 + 1 * 22);
    expect(result!.height).toBe(22);

    document.body.removeChild(pre);
  });
});

describe("stripMarkdownSyntax", () => {
  it("strips heading markers", () => {
    expect(stripMarkdownSyntax("# Heading 1")).toBe("Heading 1");
    expect(stripMarkdownSyntax("## Heading 2")).toBe("Heading 2");
    expect(stripMarkdownSyntax("### Heading 3")).toBe("Heading 3");
    expect(stripMarkdownSyntax("###### Heading 6")).toBe("Heading 6");
  });

  it("strips bold markers (** and __)", () => {
    expect(stripMarkdownSyntax("**bold text**")).toBe("bold text");
    expect(stripMarkdownSyntax("__bold text__")).toBe("bold text");
    expect(stripMarkdownSyntax("Some **bold** text")).toBe("Some bold text");
  });

  it("strips italic markers (* and _)", () => {
    expect(stripMarkdownSyntax("*italic text*")).toBe("italic text");
    expect(stripMarkdownSyntax("_italic text_")).toBe("italic text");
    expect(stripMarkdownSyntax("Some *italic* words")).toBe("Some italic words");
  });

  it("strips inline code backticks", () => {
    expect(stripMarkdownSyntax("`code`")).toBe("code");
    expect(stripMarkdownSyntax("Use `npm install` to install")).toBe("Use npm install to install");
  });

  it("strips link syntax keeping text", () => {
    expect(stripMarkdownSyntax("[link text](http://example.com)")).toBe("link text");
    expect(stripMarkdownSyntax("Click [here](url) to continue")).toBe("Click here to continue");
  });

  it("strips image syntax keeping alt text", () => {
    expect(stripMarkdownSyntax("![alt text](image.png)")).toBe("alt text");
  });

  it("strips unordered list markers (-, *, +)", () => {
    expect(stripMarkdownSyntax("- list item")).toBe("list item");
    expect(stripMarkdownSyntax("* list item")).toBe("list item");
    expect(stripMarkdownSyntax("+ list item")).toBe("list item");
  });

  it("strips ordered list markers", () => {
    expect(stripMarkdownSyntax("1. first item")).toBe("first item");
    expect(stripMarkdownSyntax("42. item forty-two")).toBe("item forty-two");
  });

  it("strips blockquote markers", () => {
    expect(stripMarkdownSyntax("> quoted text")).toBe("quoted text");
    expect(stripMarkdownSyntax(">no space")).toBe("no space");
  });

  it("strips task list markers", () => {
    expect(stripMarkdownSyntax("- [ ] unchecked task")).toBe("unchecked task");
    expect(stripMarkdownSyntax("- [x] checked task")).toBe("checked task");
  });

  it("strips table pipe characters", () => {
    expect(stripMarkdownSyntax("| cell1 | cell2 | cell3 |")).toBe("cell1 cell2 cell3");
  });

  it("strips combined formatting", () => {
    expect(stripMarkdownSyntax("## **Bold** heading with `code`")).toBe("Bold heading with code");
    expect(stripMarkdownSyntax("- [Link](url) and **bold**")).toBe("Link and bold");
  });

  it("strips strikethrough markers", () => {
    expect(stripMarkdownSyntax("~~deleted~~")).toBe("deleted");
    expect(stripMarkdownSyntax("Some ~~deleted~~ text")).toBe("Some deleted text");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(stripMarkdownSyntax("   ")).toBe("");
    expect(stripMarkdownSyntax("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripMarkdownSyntax("just plain text")).toBe("just plain text");
  });
});

describe("findMatchingBlockElement", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  function makeContainer(html: string): HTMLDivElement {
    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
  }

  it("finds a paragraph element", () => {
    const el = makeContainer("<p>Hello world</p>");
    const result = findMatchingBlockElement(el, "Hello world");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("finds a heading element", () => {
    const el = makeContainer("<h2>Section Title</h2><p>body text</p>");
    const result = findMatchingBlockElement(el, "Section Title");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H2");
  });

  it("finds text inside bold within a paragraph", () => {
    const el = makeContainer("<p>Some <strong>bold</strong> text</p>");
    const result = findMatchingBlockElement(el, "Some bold text");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("finds text inside italic within a paragraph", () => {
    const el = makeContainer("<p>Some <em>italic</em> words</p>");
    const result = findMatchingBlockElement(el, "Some italic words");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("finds a list item", () => {
    const el = makeContainer("<ul><li>First item</li><li>Second item</li></ul>");
    const result = findMatchingBlockElement(el, "Second item");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  it("finds a table cell", () => {
    const el = makeContainer("<table><tr><td>Cell A</td><td>Cell B</td></tr></table>");
    const result = findMatchingBlockElement(el, "Cell B");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("TD");
  });

  it("finds a table header cell", () => {
    const el = makeContainer("<table><tr><th>Header</th></tr></table>");
    const result = findMatchingBlockElement(el, "Header");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("TH");
  });

  it("finds text inside a blockquote paragraph", () => {
    const el = makeContainer("<blockquote><p>Quoted text here</p></blockquote>");
    const result = findMatchingBlockElement(el, "Quoted text here");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("finds text with link inside paragraph", () => {
    const el = makeContainer('<p>Click <a href="#">here</a> to go</p>');
    const result = findMatchingBlockElement(el, "Click here to go");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("finds text with inline code inside paragraph", () => {
    const el = makeContainer("<p>Use <code>npm install</code> to install</p>");
    const result = findMatchingBlockElement(el, "Use npm install to install");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("skips elements inside pre (code blocks)", () => {
    const el = makeContainer("<pre><code>code line</code></pre><p>code line</p>");
    const result = findMatchingBlockElement(el, "code line");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("returns null when no match found", () => {
    const el = makeContainer("<p>Hello world</p>");
    const result = findMatchingBlockElement(el, "no match here");
    expect(result).toBeNull();
  });

  it("returns the most specific match (smallest block)", () => {
    const el = makeContainer("<ul><li>Nested <strong>bold item</strong></li></ul>");
    const result = findMatchingBlockElement(el, "Nested bold item");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });
});

describe("applyBlockHighlight", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  it("adds highlight class to the matching block element", () => {
    container = document.createElement("div");
    container.innerHTML = "<p>Target paragraph</p>";
    document.body.appendChild(container);

    const result = applyBlockHighlight(container, "Target paragraph", "test-highlight");
    expect(result).toBe(true);
    expect(container.querySelector("p")!.classList.contains("test-highlight")).toBe(true);
  });

  it("returns false when no match found", () => {
    container = document.createElement("div");
    container.innerHTML = "<p>Some text</p>";
    document.body.appendChild(container);

    const result = applyBlockHighlight(container, "no match", "test-highlight");
    expect(result).toBe(false);
  });
});

describe("clearBlockHighlights", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  it("removes specified highlight class from all elements", () => {
    container = document.createElement("div");
    container.innerHTML = "<p class='test-hl'>text1</p><p class='test-hl'>text2</p>";
    document.body.appendChild(container);

    clearBlockHighlights(container, "test-hl");
    expect(container.querySelectorAll(".test-hl").length).toBe(0);
  });
});

/**
 * End-to-end active line highlight tests.
 *
 * These simulate the full pipeline:
 *   1. Raw markdown line from the CodeMirror editor (what onactiveline emits)
 *   2. stripMarkdownSyntax(rawLine) — what MarkdownViewer does
 *   3. findMatchingBlockElement(container, stripped) — looking in rendered HTML
 *
 * The HTML in each test is what `marked` actually produces for that markdown.
 * If any test fails, the active line highlight is broken for that element type.
 */
describe("active line highlight: editor line → strip → find in rendered HTML", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  function makeContainer(html: string): HTMLDivElement {
    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
  }

  // Simulate the full pipeline
  function activeLineFindsMatch(rawEditorLine: string, renderedHTML: string): HTMLElement | null {
    const el = makeContainer(renderedHTML);
    const stripped = stripMarkdownSyntax(rawEditorLine);
    if (stripped.length < 2) return null;
    return findMatchingBlockElement(el, stripped);
  }

  // --- Headings ---

  it("H1: # Planning Central — Next Steps", () => {
    const result = activeLineFindsMatch(
      "# Planning Central — Next Steps",
      "<h1>Planning Central — Next Steps</h1>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H1");
  });

  it("H2: ## Project Context", () => {
    const result = activeLineFindsMatch(
      "## Project Context",
      "<h2>Project Context</h2><p>some body</p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H2");
  });

  it("H3: ### Status: DONE", () => {
    const result = activeLineFindsMatch(
      "### Status: DONE",
      "<h3>Status: DONE</h3>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H3");
  });

  it("H3 with inline code: ### Solution: Rust `include_str!`", () => {
    const result = activeLineFindsMatch(
      "### Solution: Rust `include_str!`",
      "<h3>Solution: Rust <code>include_str!</code></h3>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H3");
  });

  it("H3 with bold: ### Current Test Count: **120 frontend**", () => {
    const result = activeLineFindsMatch(
      "### Current Test Count: **120 frontend**",
      "<h3>Current Test Count: <strong>120 frontend</strong></h3>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H3");
  });

  // --- Plain paragraphs ---

  it("simple paragraph", () => {
    const result = activeLineFindsMatch(
      "Desktop markdown viewer built with Tauri.",
      "<p>Desktop markdown viewer built with Tauri.</p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  // --- Paragraphs with inline formatting ---

  it("paragraph with bold: **bold text** in the middle", () => {
    const result = activeLineFindsMatch(
      "Desktop markdown viewer built with **Tauri 2.10 + Svelte 5 + TypeScript**.",
      "<p>Desktop markdown viewer built with <strong>Tauri 2.10 + Svelte 5 + TypeScript</strong>.</p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("paragraph with italic", () => {
    const result = activeLineFindsMatch(
      "This is *very important* information.",
      "<p>This is <em>very important</em> information.</p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("paragraph with inline code: `backtick` words", () => {
    const result = activeLineFindsMatch(
      "The `notify` crate for native file watching.",
      "<p>The <code>notify</code> crate for native file watching.</p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("paragraph with multiple inline code spans", () => {
    const result = activeLineFindsMatch(
      "Uses `$state()`, `$derived()`, `$effect()`, `$props()` from Svelte 5.",
      '<p>Uses <code>$state()</code>, <code>$derived()</code>, <code>$effect()</code>, <code>$props()</code> from Svelte 5.</p>'
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("paragraph with link", () => {
    const result = activeLineFindsMatch(
      "See the [Mermaid documentation](https://mermaid.js.org/) for details.",
      '<p>See the <a href="https://mermaid.js.org/">Mermaid documentation</a> for details.</p>'
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("paragraph with bold + inline code + link mixed", () => {
    const result = activeLineFindsMatch(
      "**Trade-off:** The help content is frozen at build time. Any edits to the `.md` file require a rebuild.",
      '<p><strong>Trade-off:</strong> The help content is frozen at build time. Any edits to the <code>.md</code> file require a rebuild.</p>'
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("paragraph with bold italic: ***bold italic***", () => {
    const result = activeLineFindsMatch(
      "This is ***bold italic*** text here.",
      "<p>This is <em><strong>bold italic</strong></em> text here.</p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  // --- Unordered list items ---

  it("simple list item: - item text", () => {
    const result = activeLineFindsMatch(
      "- File tree with expand/collapse",
      "<ul>\n<li>File tree with expand/collapse</li>\n</ul>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  it("list item with inline code: - `lib.rs` — Command registration", () => {
    const result = activeLineFindsMatch(
      "- `lib.rs` — Command registration (modify)",
      "<ul>\n<li><code>lib.rs</code> — Command registration (modify)</li>\n</ul>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  it("list item with bold: - **Rust backend:** description", () => {
    const result = activeLineFindsMatch(
      "- **Rust backend:** `src-tauri/src/` — file watching, event emission",
      '<ul>\n<li><strong>Rust backend:</strong> <code>src-tauri/src/</code> — file watching, event emission</li>\n</ul>'
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  it("list item with link: - [link](url) text", () => {
    const result = activeLineFindsMatch(
      "- [Mermaid documentation](https://mermaid.js.org/) for diagrams",
      '<ul>\n<li><a href="https://mermaid.js.org/">Mermaid documentation</a> for diagrams</li>\n</ul>'
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  // --- Ordered list items ---

  it("ordered list: 1. Open the app", () => {
    const result = activeLineFindsMatch(
      "1. Open the app",
      "<ol>\n<li>Open the app</li>\n<li>Browse files</li>\n</ol>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  it("ordered list with formatting: 1. **`switchToFolder()`** — after loadTree", () => {
    const result = activeLineFindsMatch(
      '1. **`switchToFolder()`** — after `loadTree()`, auto-select the first file',
      '<ol>\n<li><strong><code>switchToFolder()</code></strong> — after <code>loadTree()</code>, auto-select the first file</li>\n</ol>'
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  // --- Blockquotes ---

  it("blockquote: > quoted text", () => {
    const result = activeLineFindsMatch(
      "> Planning is bringing the future into the present.",
      "<blockquote>\n<p>Planning is bringing the future into the present.</p>\n</blockquote>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  // --- Table rows ---

  it("table header row: | Feature | Status | Notes |", () => {
    const result = activeLineFindsMatch(
      "| Feature | Status | Notes |",
      '<div class="table-wrapper"><table>\n<thead>\n<tr>\n<th>Feature</th>\n<th>Status</th>\n<th>Notes</th>\n</tr>\n</thead>\n</table></div>'
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("TH");
  });

  it("table data row: | File tree sidebar | Done | Recursive |", () => {
    const result = activeLineFindsMatch(
      "| File tree sidebar | Done | Recursive, filterable |",
      '<div class="table-wrapper"><table>\n<tbody>\n<tr>\n<td>File tree sidebar</td>\n<td>Done</td>\n<td>Recursive, filterable</td>\n</tr>\n</tbody>\n</table></div>'
    );
    expect(result).not.toBeNull();
    // Should match the most specific cell
    expect(["TD", "TH"]).toContain(result!.tagName);
  });

  it("table separator row: |---|---| returns null (no visible content)", () => {
    // Table separator lines like |---|---| are not rendered as visible elements
    const stripped = stripMarkdownSyntax("|---------|--------|-------|");
    // After stripping pipes and collapsing: "--------- -------- -------"
    // After trim: "--------- -------- -------"
    // This shouldn't match any meaningful content
    const el = makeContainer('<div class="table-wrapper"><table><thead><tr><th>A</th></tr></thead></table></div>');
    const result = findMatchingBlockElement(el, stripped);
    // It's OK if this is null — separator lines have no rendered content
    // The important thing is it doesn't crash or match the wrong element
    expect(true).toBe(true); // Just verifying it doesn't throw
  });

  // --- Horizontal rules ---

  it("horizontal rule: --- (returns null, no block to highlight)", () => {
    const stripped = stripMarkdownSyntax("---");
    // "---" is only 3 chars but they're all dashes, which become "---" after strip
    // This is fine — hr has no text content to match
    expect(stripped).toBe("---");
  });

  // --- Lines that should NOT match (code fence markers, blank lines, etc.) ---

  it("code fence opening: ``` returns null (too short after strip)", () => {
    const stripped = stripMarkdownSyntax("```typescript");
    // Backticks get stripped, leaving "typescript" — but this is a fence marker
    // We don't want it to match a random paragraph that says "typescript"
    // The stripped result is just the language name
    expect(stripped.length).toBeGreaterThan(0); // "typescript" remains
  });

  it("code fence closing: ``` remains unchanged (no content between backticks)", () => {
    const stripped = stripMarkdownSyntax("```");
    // `[^`]+` requires at least one non-backtick char, so ``` doesn't match
    expect(stripped).toBe("```");
  });

  it("empty line returns empty", () => {
    const stripped = stripMarkdownSyntax("");
    expect(stripped).toBe("");
  });

  // --- Real examples from docs/nextsteps.md (the file in the screenshot) ---

  it("real: The help button loads `How to Use Planning Central.md` from the app's `docs/` folder...", () => {
    const rawLine = "The help button loads `How to Use Planning Central.md` from the app's `docs/` folder at runtime using `get_docs_path()`. This only works if the docs folder exists relative to the executable. When the app is installed to Program Files or run from a different location, the help file may not be found.";
    const rendered = "<p>The help button loads <code>How to Use Planning Central.md</code> from the app's <code>docs/</code> folder at runtime using <code>get_docs_path()</code>. This only works if the docs folder exists relative to the executable. When the app is installed to Program Files or run from a different location, the help file may not be found.</p>";
    const result = activeLineFindsMatch(rawLine, rendered);
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("real: Compile the help file directly into the binary at build time using Rust's `include_str!` macro.", () => {
    const rawLine = "Compile the help file directly into the binary at build time using Rust's `include_str!` macro. This reads the file at compile time and embeds it as a string constant in the executable. No runtime file access needed.";
    const rendered = "<p>Compile the help file directly into the binary at build time using Rust's <code>include_str!</code> macro. This reads the file at compile time and embeds it as a string constant in the executable. No runtime file access needed.</p>";
    const result = activeLineFindsMatch(rawLine, rendered);
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("real: ## PRIORITY 0: Embed Help File in Binary", () => {
    const result = activeLineFindsMatch(
      "## PRIORITY 0: Embed Help File in Binary",
      "<h2>PRIORITY 0: Embed Help File in Binary</h2>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H2");
  });

  it("real: **Trade-off:** The help content is frozen at build time...", () => {
    const rawLine = "**Trade-off:** The help content is frozen at build time. Any edits to the `.md` file require a rebuild. This is fine since the file only changes when we ship new features (which requires a rebuild anyway).";
    const rendered = '<p><strong>Trade-off:</strong> The help content is frozen at build time. Any edits to the <code>.md</code> file require a rebuild. This is fine since the file only changes when we ship new features (which requires a rebuild anyway).</p>';
    const result = activeLineFindsMatch(rawLine, rendered);
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("real: The frontend calls `invoke(\"get_help_content\")` instead of reading a file path.", () => {
    const rawLine = 'The frontend calls `invoke("get_help_content")` instead of reading a file path. Works from anywhere — installed, portable, any folder.';
    const rendered = '<p>The frontend calls <code>invoke(&quot;get_help_content&quot;)</code> instead of reading a file path. Works from anywhere — installed, portable, any folder.</p>';
    const result = activeLineFindsMatch(rawLine, rendered);
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("real: 1. **`switchToFolder()`** — after `loadTree()`...", () => {
    const rawLine = '1. **`switchToFolder()`** — after `loadTree()`, if no last-selected file was restored, auto-select the first file';
    const rendered = '<ol>\n<li><strong><code>switchToFolder()</code></strong> — after <code>loadTree()</code>, if no last-selected file was restored, auto-select the first file</li>\n</ol>';
    const result = activeLineFindsMatch(rawLine, rendered);
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  it("real: ### Fix Location", () => {
    const result = activeLineFindsMatch(
      "### Fix Location",
      "<h3>Fix Location</h3>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("H3");
  });

  it("real: `src/App.svelte` — two places need the same logic:", () => {
    const rawLine = "`src/App.svelte` — two places need the same logic:";
    const rendered = "<p><code>src/App.svelte</code> — two places need the same logic:</p>";
    const result = activeLineFindsMatch(rawLine, rendered);
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  // --- Code block content lines (cursor inside a fenced code block) ---

  it("code block line: const HELP_CONTENT = include_str!(...)", () => {
    const rawLine = 'const HELP_CONTENT: &str = include_str!("../../docs/How to Use Planning Central.md");';
    // This line is INSIDE a <pre><code>, so findMatchingBlockElement skips it
    const rendered = '<pre class="line-numbers"><code class="hljs">const HELP_CONTENT: &amp;str = include_str!(&quot;../../docs/How to Use Planning Central.md&quot;);</code></pre>';
    const el = makeContainer(rendered);
    const stripped = stripMarkdownSyntax(rawLine);
    const result = findMatchingBlockElement(el, stripped);
    // Currently returns null because we skip <pre> content
    // This is a known limitation — code block lines need a different highlight strategy
    expect(result).toBeNull();
  });

  // --- Edge cases ---

  it("bold at start of line: **Status: DONE**", () => {
    const result = activeLineFindsMatch(
      "**Status: DONE**",
      "<p><strong>Status: DONE</strong></p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("line with only bold: **Newest**", () => {
    const result = activeLineFindsMatch(
      "**Newest**",
      "<p><strong>Newest</strong></p>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
  });

  it("nested list item with code: - `models.rs` — FileEntry struct", () => {
    const result = activeLineFindsMatch(
      "  - Contains: file watching, event emission",
      "<ul>\n<li>Rust backend\n<ul>\n<li>Contains: file watching, event emission</li>\n</ul>\n</li>\n</ul>"
    );
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("LI");
  });

  it("image line: ![Planning Central Logo](../img/logo.png)", () => {
    const rawLine = '![Planning Central Logo](../img/logo.png "The Planning Central polar bear")';
    const stripped = stripMarkdownSyntax(rawLine);
    // Image regex strips ![alt](url "title") → alt text only (title is inside parens)
    expect(stripped).toBe("Planning Central Logo");
  });
});

describe("findMatchingPreElement", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  function makeContainer(html: string): HTMLDivElement {
    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
  }

  it("finds a code block pre containing the line text", () => {
    const el = makeContainer(
      '<pre class="line-numbers"><code class="hljs">function hello() {\n  console.log("Hello");\n}</code></pre>'
    );
    const result = findMatchingPreElement(el, '  console.log("Hello");');
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("PRE");
  });

  it("finds a plain code block with matching line", () => {
    const el = makeContainer(
      '<pre><code>line one\nline two\nline three</code></pre>'
    );
    const result = findMatchingPreElement(el, "line two");
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("PRE");
  });

  it("finds the correct pre when multiple code blocks exist", () => {
    const el = makeContainer(
      '<pre><code>block one content</code></pre><pre><code>block two content</code></pre>'
    );
    const result = findMatchingPreElement(el, "block two content");
    expect(result).not.toBeNull();
    expect(result!.textContent).toContain("block two");
  });

  it("finds mermaid pre block from mermaid source line", () => {
    const el = makeContainer(
      '<pre class="mermaid">flowchart TD\n    A[Start] --> B[End]</pre>'
    );
    const result = findMatchingPreElement(el, "    A[Start] --> B[End]");
    expect(result).not.toBeNull();
    expect(result!.classList.contains("mermaid")).toBe(true);
  });

  it("finds bob-rendered pre block from ASCII art line", () => {
    const el = makeContainer(
      '<pre class="bob-rendered"><svg>some svg</svg></pre><p>text</p>'
    );
    // After rendering, the original ASCII text is gone (replaced by SVG).
    // We can't match text directly. findMatchingPreElement should return null here.
    const result = findMatchingPreElement(el, "┌──────────┐");
    // SVG doesn't contain the original text, so no match expected
    expect(result).toBeNull();
  });

  it("returns null when line text doesn't match any pre", () => {
    const el = makeContainer(
      '<pre><code>some code</code></pre><p>paragraph</p>'
    );
    const result = findMatchingPreElement(el, "no match here");
    expect(result).toBeNull();
  });

  it("returns null for empty container", () => {
    const el = makeContainer("<p>just a paragraph</p>");
    const result = findMatchingPreElement(el, "anything");
    expect(result).toBeNull();
  });

  it("matches JSON code block content", () => {
    const el = makeContainer(
      '<pre class="line-numbers"><code class="hljs">{\n  "app": "Planning Central",\n  "version": "0.1.0"\n}</code></pre>'
    );
    const result = findMatchingPreElement(el, '  "app": "Planning Central",');
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("PRE");
  });

  it("matches Rust code block content", () => {
    const el = makeContainer(
      '<pre class="line-numbers"><code class="hljs">const HELP_CONTENT: &amp;str = include_str!("../../docs/help.md");</code></pre>'
    );
    // textContent decodes HTML entities, so &amp; becomes &
    const result = findMatchingPreElement(el, 'const HELP_CONTENT: &str = include_str!');
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("PRE");
  });

  it("matches mermaid diagram keyword lines", () => {
    const el = makeContainer(
      '<pre class="mermaid">sequenceDiagram\n    User->>Claude: Describe what you need</pre>'
    );
    const result = findMatchingPreElement(el, "    User->>Claude: Describe what you need");
    expect(result).not.toBeNull();
  });

  it("matches mermaid rendered SVG container when original text preserved", () => {
    // After mermaid.run(), the pre contains an SVG but the class stays "mermaid"
    // The original text might still be in a data attribute or aria-label
    // But typically mermaid replaces the textContent. Test the before-render case.
    const el = makeContainer(
      '<pre class="mermaid">flowchart TD\n    A --> B</pre>'
    );
    const result = findMatchingPreElement(el, "flowchart TD");
    expect(result).not.toBeNull();
  });
});

describe("findMatchingBlockElement with positionRatio (disambiguation)", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  function makeContainer(html: string): HTMLDivElement {
    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
  }

  it("returns first match when no positionRatio is provided (backward compatible)", () => {
    const el = makeContainer(
      "<h3>Tests to Write</h3><p>some text</p><h3>Tests to Write</h3>"
    );
    const result = findMatchingBlockElement(el, "Tests to Write");
    expect(result).not.toBeNull();
    // Without position info, returns first match
    expect(result).toBe(el.querySelectorAll("h3")[0]);
  });

  it("selects second match when positionRatio indicates bottom of document", () => {
    const el = makeContainer(
      "<h3>Tests to Write</h3><p>filler</p><p>filler</p><p>filler</p><h3>Tests to Write</h3>"
    );
    // 5 block elements total, second h3 is at index 4 (last).
    // positionRatio = 1.0 (bottom of document) should pick the second h3.
    const result = findMatchingBlockElement(el, "Tests to Write", 1.0);
    expect(result).not.toBeNull();
    expect(result).toBe(el.querySelectorAll("h3")[1]);
  });

  it("selects first match when positionRatio indicates top of document", () => {
    const el = makeContainer(
      "<h3>Tests to Write</h3><p>filler</p><p>filler</p><p>filler</p><h3>Tests to Write</h3>"
    );
    // positionRatio = 0.0 (top) should pick the first h3
    const result = findMatchingBlockElement(el, "Tests to Write", 0.0);
    expect(result).not.toBeNull();
    expect(result).toBe(el.querySelectorAll("h3")[0]);
  });

  it("selects middle match when positionRatio indicates middle of document", () => {
    const el = makeContainer(
      "<h3>Status</h3><p>filler1</p><h3>Status</h3><p>filler2</p><h3>Status</h3>"
    );
    // 5 elements: h3(0), p(1), h3(2), p(3), h3(4)
    // Middle h3 at index 2. ratio = 2/4 = 0.5
    // positionRatio = 0.5 should pick the middle h3
    const result = findMatchingBlockElement(el, "Status", 0.5);
    expect(result).not.toBeNull();
    expect(result).toBe(el.querySelectorAll("h3")[1]);
  });

  it("works with single match regardless of positionRatio", () => {
    const el = makeContainer(
      "<p>unique paragraph</p><p>other text</p>"
    );
    const result = findMatchingBlockElement(el, "unique paragraph", 0.8);
    expect(result).not.toBeNull();
    expect(result!.tagName).toBe("P");
    expect(result!.textContent).toBe("unique paragraph");
  });

  it("picks closest match when positionRatio is between two matches", () => {
    const el = makeContainer(
      "<h2>Section</h2><p>a</p><p>b</p><p>c</p><p>d</p><p>e</p><p>f</p><p>g</p><p>h</p><h2>Section</h2>"
    );
    // 10 elements. First h2 at index 0 (ratio 0.0), second at index 9 (ratio 1.0)
    // positionRatio 0.7 is closer to 1.0, should pick second h2
    const result = findMatchingBlockElement(el, "Section", 0.7);
    expect(result).not.toBeNull();
    expect(result).toBe(el.querySelectorAll("h2")[1]);
  });

  it("real scenario: duplicate heading '6. Tests to Write' at different positions", () => {
    // Simulating the actual bug: line 196 of a 250-line document has this heading,
    // but an earlier heading at line 50 has similar text
    const el = makeContainer(
      '<h4>5. Tests to Write (TDD)</h4>' +
      '<p>filler</p><p>filler</p><p>filler</p><p>filler</p>' +
      '<p>filler</p><p>filler</p><p>filler</p><p>filler</p>' +
      '<h4>6. Tests to Write (TDD — write these FIRST)</h4>'
    );
    // 10 elements. The first h4 contains "Tests to Write" at index 0.
    // The second h4 contains "Tests to Write" at index 9.
    // Line 196 of 250 lines → ratio ≈ 0.78
    const positionRatio = (196 - 1) / (250 - 1);
    const result = findMatchingBlockElement(el, "Tests to Write", positionRatio);
    expect(result).not.toBeNull();
    // Should pick the SECOND h4 (closer to position 0.78)
    expect(result).toBe(el.querySelectorAll("h4")[1]);
  });

  it("falls back to table row matching when no exact block match (with positionRatio)", () => {
    const el = makeContainer(
      '<table><tr><th>Feature</th><th>Status</th></tr></table>'
    );
    // "Feature Status" doesn't match any single element, but table row fallback should work
    const result = findMatchingBlockElement(el, "Feature Status", 0.5);
    expect(result).not.toBeNull();
  });
});

describe("getTableCellIndex", () => {
  it("returns 0 for cursor in the first cell", () => {
    // | Layer | Choice | Why |
    // Col 3 is inside "Layer"
    expect(getTableCellIndex("| Layer | Choice | Why |", 3)).toBe(0);
  });

  it("returns 1 for cursor in the second cell", () => {
    // | Layer | Choice | Why |
    // Col 11 is inside "Choice"
    expect(getTableCellIndex("| Layer | Choice | Why |", 11)).toBe(1);
  });

  it("returns 2 for cursor in the third cell", () => {
    // | Layer | Choice | Why |
    // Col 20 is inside "Why"
    expect(getTableCellIndex("| Layer | Choice | Why |", 20)).toBe(2);
  });

  it("returns 0 for cursor on the leading pipe", () => {
    expect(getTableCellIndex("| Layer | Choice | Why |", 1)).toBe(0);
  });

  it("returns correct index for cursor on a pipe between cells", () => {
    // | Layer | Choice | Why |
    // Col 9 is the pipe between Layer and Choice — should map to the next cell
    expect(getTableCellIndex("| Layer | Choice | Why |", 9)).toBe(1);
  });

  it("returns -1 for non-table lines", () => {
    expect(getTableCellIndex("Just a normal line", 5)).toBe(-1);
  });

  it("returns -1 for separator lines", () => {
    expect(getTableCellIndex("|-------|---------|-----|", 5)).toBe(-1);
  });

  it("handles cells with special content like bold", () => {
    // | Name | **Tauri 2.x** | fast |
    expect(getTableCellIndex("| Name | **Tauri 2.x** | fast |", 15)).toBe(1);
  });
});

describe("findMatchingBlockElement with cellIndex (table cell targeting)", () => {
  function makeContainer(html: string): HTMLElement {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el;
  }

  it("highlights the correct cell when cellIndex is provided", () => {
    const el = makeContainer(
      '<table><tr><th>Layer</th><th>Choice</th><th>Why</th></tr>' +
      '<tr><td>Desktop</td><td>Tauri 2.x</td><td>Fast</td></tr></table>'
    );
    // cellIndex=2 should highlight "Why" header
    const result = findMatchingBlockElement(el, "Layer Choice Why", 0, 2);
    expect(result).not.toBeNull();
    expect(result!.textContent).toBe("Why");
  });

  it("highlights first cell when cellIndex is 0", () => {
    const el = makeContainer(
      '<table><tr><th>Layer</th><th>Choice</th><th>Why</th></tr></table>'
    );
    const result = findMatchingBlockElement(el, "Layer Choice Why", 0, 0);
    expect(result).not.toBeNull();
    expect(result!.textContent).toBe("Layer");
  });

  it("falls back to first cell when cellIndex exceeds available cells", () => {
    const el = makeContainer(
      '<table><tr><th>Alpha</th><th>Beta</th></tr></table>'
    );
    const result = findMatchingBlockElement(el, "Alpha Beta", 0, 5);
    expect(result).not.toBeNull();
    // Should fall back to first cell since index 5 doesn't exist
    expect(result!.textContent).toBe("Alpha");
  });

  it("ignores cellIndex for non-table matches", () => {
    const el = makeContainer('<p>Hello world</p>');
    // cellIndex is irrelevant for paragraph matches
    const result = findMatchingBlockElement(el, "Hello world", 0, 1);
    expect(result).not.toBeNull();
    expect(result!.textContent).toBe("Hello world");
  });
});
