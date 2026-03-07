import { describe, it, expect } from "vitest";
import { extractHeadings } from "./toc";

describe("extractHeadings", () => {
  it("returns empty array for empty content", () => {
    expect(extractHeadings("")).toEqual([]);
  });

  it("returns empty array for content with no headings", () => {
    expect(extractHeadings("Just a paragraph.\n\nAnother one.")).toEqual([]);
  });

  it("extracts a single h1", () => {
    const result = extractHeadings("# Hello World");
    expect(result).toEqual([{ text: "Hello World", slug: "hello-world", depth: 1 }]);
  });

  it("extracts multiple mixed-depth headings", () => {
    const result = extractHeadings("# Title\n\n## Section\n\n### Subsection\n\n## Another");
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ text: "Title", slug: "title", depth: 1 });
    expect(result[1]).toEqual({ text: "Section", slug: "section", depth: 2 });
    expect(result[2]).toEqual({ text: "Subsection", slug: "subsection", depth: 3 });
    expect(result[3]).toEqual({ text: "Another", slug: "another", depth: 2 });
  });

  it("strips inline markdown from display text", () => {
    const result = extractHeadings("# **Bold** and *italic* and `code`");
    expect(result[0].text).toBe("Bold and italic and code");
  });

  it("strips links from display text", () => {
    const result = extractHeadings("# Check [this link](http://example.com) out");
    expect(result[0].text).toBe("Check this link out");
  });

  it("generates correct slugs matching slugify output", () => {
    const result = extractHeadings("# Hello World!");
    expect(result[0].slug).toBe("hello-world");
  });

  it("deduplicates slugs", () => {
    const result = extractHeadings("## API\n\n## API\n\n## API");
    expect(result[0].slug).toBe("api");
    expect(result[1].slug).toBe("api-1");
    expect(result[2].slug).toBe("api-2");
  });

  it("ignores headings inside fenced code blocks", () => {
    const content = "# Real Heading\n\n```\n# Not a heading\n```\n\n## Another Real";
    const result = extractHeadings(content);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Real Heading");
    expect(result[1].text).toBe("Another Real");
  });

  it("handles special characters in headings", () => {
    const result = extractHeadings("# C++ & C#: A Comparison");
    expect(result[0].text).toBe("C++ & C#: A Comparison");
    expect(result[0].slug).toBe("c-c-a-comparison");
  });

  it("handles all heading depths (h1-h6)", () => {
    const content = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
    const result = extractHeadings(content);
    expect(result).toHaveLength(6);
    expect(result.map(e => e.depth)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
