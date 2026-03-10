import { describe, it, expect } from "vitest";
import { extractReadableText } from "./tts";
import type { TtsSegment } from "./tts";

describe("extractReadableText", () => {
  it("returns empty array for empty content", () => {
    expect(extractReadableText("")).toEqual([]);
  });

  it("returns empty array for whitespace-only content", () => {
    expect(extractReadableText("   \n\n  ")).toEqual([]);
  });

  it("extracts a simple paragraph", () => {
    const segments = extractReadableText("Hello world.");
    expect(segments.length).toBe(1);
    expect(segments[0].text).toBe("Hello world.");
  });

  it("extracts headings", () => {
    const segments = extractReadableText("# My Heading\n\nSome text.");
    expect(segments.length).toBe(2);
    expect(segments[0].text).toBe("My Heading");
    expect(segments[1].text).toBe("Some text.");
  });

  it("extracts multiple headings at different depths", () => {
    const segments = extractReadableText("# H1\n\n## H2\n\n### H3");
    expect(segments.length).toBe(3);
    expect(segments[0].text).toBe("H1");
    expect(segments[1].text).toBe("H2");
    expect(segments[2].text).toBe("H3");
  });

  it("skips code blocks", () => {
    const md = "Before code.\n\n```js\nconst x = 1;\n```\n\nAfter code.";
    const segments = extractReadableText(md);
    const texts = segments.map((s) => s.text);
    expect(texts).toContain("Before code.");
    expect(texts).toContain("After code.");
    expect(texts.some((t) => t.includes("const x"))).toBe(false);
  });

  it("skips mermaid blocks", () => {
    const md = "Before.\n\n```mermaid\ngraph TD\nA-->B\n```\n\nAfter.";
    const segments = extractReadableText(md);
    const texts = segments.map((s) => s.text);
    expect(texts).toContain("Before.");
    expect(texts).toContain("After.");
    expect(texts.some((t) => t.includes("graph"))).toBe(false);
  });

  it("skips bob/svgbob blocks", () => {
    const md = "Before.\n\n```bob\n+--+\n|  |\n+--+\n```\n\nAfter.";
    const segments = extractReadableText(md);
    const texts = segments.map((s) => s.text);
    expect(texts.some((t) => t.includes("+--+"))).toBe(false);
  });

  it("skips horizontal rules", () => {
    const md = "Before.\n\n---\n\nAfter.";
    const segments = extractReadableText(md);
    const texts = segments.map((s) => s.text);
    expect(texts).toContain("Before.");
    expect(texts).toContain("After.");
    expect(texts.length).toBe(2);
  });

  it("skips HTML blocks", () => {
    const md = "Before.\n\n<div>HTML content</div>\n\nAfter.";
    const segments = extractReadableText(md);
    const texts = segments.map((s) => s.text);
    expect(texts.some((t) => t.includes("<div>"))).toBe(false);
  });

  it("strips bold/italic formatting", () => {
    const segments = extractReadableText("This is **bold** and *italic* text.");
    expect(segments[0].text).toBe("This is bold and italic text.");
  });

  it("strips link syntax, keeps text", () => {
    const segments = extractReadableText("Click [here](https://example.com) for more.");
    expect(segments[0].text).toBe("Click here for more.");
  });

  it("strips image syntax", () => {
    const segments = extractReadableText("See ![alt text](image.png) below.");
    expect(segments[0].text).toBe("See alt text below.");
  });

  it("converts wikilinks to alias text", () => {
    const segments = extractReadableText("See [[target|display name]] for details.");
    expect(segments[0].text).toBe("See display name for details.");
  });

  it("converts wikilinks without alias to target name", () => {
    const segments = extractReadableText("See [[my file]] for details.");
    expect(segments[0].text).toBe("See my file for details.");
  });

  it("extracts list items", () => {
    const md = "- First item\n- Second item\n- Third item";
    const segments = extractReadableText(md);
    expect(segments.length).toBeGreaterThanOrEqual(1);
    const allText = segments.map((s) => s.text).join(" ");
    expect(allText).toContain("First item");
    expect(allText).toContain("Second item");
    expect(allText).toContain("Third item");
  });

  it("extracts ordered list items", () => {
    const md = "1. Alpha\n2. Beta\n3. Gamma";
    const segments = extractReadableText(md);
    const allText = segments.map((s) => s.text).join(" ");
    expect(allText).toContain("Alpha");
    expect(allText).toContain("Beta");
    expect(allText).toContain("Gamma");
  });

  it("extracts blockquote text", () => {
    const md = "> This is a quote.";
    const segments = extractReadableText(md);
    const allText = segments.map((s) => s.text).join(" ");
    expect(allText).toContain("This is a quote.");
  });

  it("extracts table rows", () => {
    const md = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
    const segments = extractReadableText(md);
    const allText = segments.map((s) => s.text).join(" ");
    expect(allText).toContain("Alice");
    expect(allText).toContain("Bob");
  });

  it("includes source line numbers", () => {
    const md = "# Title\n\nParagraph here.";
    const segments = extractReadableText(md);
    expect(segments.length).toBe(2);
    // First segment (heading) should have sourceLine 1
    expect(segments[0].sourceLine).toBe(1);
    // Second segment (paragraph) should have sourceLine 3
    expect(segments[1].sourceLine).toBe(3);
  });

  it("strips inline code backticks", () => {
    const segments = extractReadableText("Use `console.log` to debug.");
    expect(segments[0].text).toBe("Use console.log to debug.");
  });

  it("strips strikethrough", () => {
    const segments = extractReadableText("This is ~~deleted~~ text.");
    expect(segments[0].text).toBe("This is deleted text.");
  });

  it("handles mixed content document", () => {
    const md = `# Welcome

This is a **document** with [links](url).

\`\`\`js
const x = 1;
\`\`\`

> A blockquote.

---

- Item one
- Item two

| Col1 | Col2 |
| --- | --- |
| A | B |

\`\`\`mermaid
graph TD
A-->B
\`\`\`

Final paragraph.`;

    const segments = extractReadableText(md);
    const texts = segments.map((s) => s.text);

    expect(texts).toContain("Welcome");
    expect(texts.some((t) => t.includes("document"))).toBe(true);
    expect(texts.some((t) => t.includes("const x"))).toBe(false);
    expect(texts.some((t) => t.includes("blockquote"))).toBe(true);
    expect(texts.some((t) => t.includes("graph TD"))).toBe(false);
    expect(texts).toContain("Final paragraph.");
  });

  it("skips empty segments after stripping", () => {
    const md = "# \n\nReal content.";
    const segments = extractReadableText(md);
    // Should not include empty heading
    expect(segments.every((s) => s.text.trim().length > 0)).toBe(true);
  });
});
