import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mermaid before importing the module under test
vi.mock("mermaid", () => ({
  default: {
    parse: vi.fn(),
  },
}));

import mermaid from "mermaid";
import { findMermaidBlocks, lintMermaidBlocks } from "./mermaid-linter";

const mockParse = vi.mocked(mermaid.parse);

beforeEach(() => {
  mockParse.mockReset();
});

describe("findMermaidBlocks", () => {
  it("finds a single mermaid block with correct positions", () => {
    const doc = "# Title\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nSome text";
    const blocks = findMermaidBlocks(doc);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe("graph TD\n  A-->B");
    // from/to should span the content inside the fences (not the fences themselves)
    const contentStart = doc.indexOf("graph TD");
    const contentEnd = doc.indexOf("\n```", contentStart);
    expect(blocks[0].from).toBe(contentStart);
    expect(blocks[0].to).toBe(contentEnd);
  });

  it("finds multiple mermaid blocks", () => {
    const doc = "```mermaid\ngraph TD\n  A-->B\n```\n\ntext\n\n```mermaid\nsequenceDiagram\n  A->>B: Hi\n```";
    const blocks = findMermaidBlocks(doc);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].content).toBe("graph TD\n  A-->B");
    expect(blocks[1].content).toBe("sequenceDiagram\n  A->>B: Hi");
  });

  it("returns empty array when no mermaid blocks exist", () => {
    const doc = "# Just a heading\n\nSome paragraph.\n\n```js\nconsole.log('hi')\n```";
    const blocks = findMermaidBlocks(doc);

    expect(blocks).toHaveLength(0);
  });

  it("handles mermaid block at the very end without trailing newline", () => {
    const doc = "```mermaid\ngraph TD\n  A-->B\n```";
    const blocks = findMermaidBlocks(doc);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe("graph TD\n  A-->B");
  });
});

describe("lintMermaidBlocks", () => {
  it("returns no diagnostics for valid mermaid blocks", async () => {
    mockParse.mockResolvedValue(undefined as any);
    const doc = "```mermaid\ngraph TD\n  A-->B\n```";
    const diagnostics = await lintMermaidBlocks(doc);

    expect(diagnostics).toHaveLength(0);
    expect(mockParse).toHaveBeenCalledWith("graph TD\n  A-->B");
  });

  it("returns error diagnostic for invalid mermaid syntax", async () => {
    mockParse.mockRejectedValue(new Error("Parse error: invalid syntax"));
    const doc = "```mermaid\ngraph INVALID!!!\n```";
    const diagnostics = await lintMermaidBlocks(doc);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("error");
    expect(diagnostics[0].message).toContain("Parse error: invalid syntax");
    // from/to should span the block content
    const contentStart = doc.indexOf("graph INVALID!!!");
    const contentEnd = doc.indexOf("\n```", contentStart);
    expect(diagnostics[0].from).toBe(contentStart);
    expect(diagnostics[0].to).toBe(contentEnd);
  });

  it("returns no diagnostics when document has no mermaid blocks", async () => {
    const doc = "# Hello\n\nJust text.";
    const diagnostics = await lintMermaidBlocks(doc);

    expect(diagnostics).toHaveLength(0);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("handles mix of valid and invalid blocks", async () => {
    mockParse
      .mockResolvedValueOnce(undefined as any) // first block valid
      .mockRejectedValueOnce(new Error("Bad diagram")); // second block invalid

    const doc = "```mermaid\ngraph TD\n  A-->B\n```\n\n```mermaid\nbroken stuff\n```";
    const diagnostics = await lintMermaidBlocks(doc);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("Bad diagram");
    // Verify the diagnostic points to the second block
    const secondBlockContent = doc.indexOf("broken stuff");
    expect(diagnostics[0].from).toBe(secondBlockContent);
  });

  it("handles non-Error rejection from mermaid.parse", async () => {
    mockParse.mockRejectedValue("string error message");
    const doc = "```mermaid\nbad\n```";
    const diagnostics = await lintMermaidBlocks(doc);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("string error message");
  });
});
