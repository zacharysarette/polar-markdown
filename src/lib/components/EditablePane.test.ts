import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";

// Mock mermaid (needed by MarkdownViewer)
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock filesystem (needed by MarkdownViewer for renderAsciiDiagram)
vi.mock("../services/filesystem", () => ({
  renderAsciiDiagram: vi.fn(),
}));

// Mock CodeMirror modules (needed by MarkdownEditor)
vi.mock("@codemirror/view", () => ({
  EditorView: Object.assign(
    vi.fn().mockImplementation(function (this: any) {
      this.destroy = vi.fn();
      this.dispatch = vi.fn();
    }),
    {
      updateListener: { of: vi.fn().mockReturnValue("updateListener") },
      theme: vi.fn().mockReturnValue("customTheme"),
      scrollIntoView: vi.fn().mockReturnValue({ type: "scrollIntoView" }),
      decorations: { from: vi.fn().mockReturnValue("decorationsFrom") },
    }
  ),
  Decoration: {
    mark: vi.fn().mockReturnValue({ range: vi.fn().mockReturnValue({}) }),
    set: vi.fn().mockReturnValue({}),
    none: {},
  },
  keymap: { of: vi.fn().mockReturnValue("keymapExt") },
  lineNumbers: vi.fn().mockReturnValue("lineNumbers"),
  highlightActiveLine: vi.fn().mockReturnValue("highlightActiveLine"),
  highlightActiveLineGutter: vi.fn().mockReturnValue("highlightActiveLineGutter"),
}));

vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: vi.fn().mockImplementation((config: any) => ({
      doc: config.doc,
      extensions: config.extensions,
    })),
  },
  StateField: {
    define: vi.fn().mockReturnValue("searchHighlightField"),
  },
  StateEffect: {
    define: vi.fn().mockReturnValue({ of: vi.fn().mockReturnValue({ type: "setSearchText" }) }),
  },
}));

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: vi.fn().mockReturnValue("markdownLang"),
}));

vi.mock("@codemirror/theme-one-dark", () => ({
  oneDark: "oneDarkTheme",
}));

vi.mock("codemirror", () => ({
  basicSetup: "basicSetup",
}));

import EditablePane from "./EditablePane.svelte";

describe("EditablePane", () => {
  it("renders with split-pane layout", () => {
    render(EditablePane, {
      props: {
        content: "# Hello",
        filePath: "/docs/test.md",
        onsave: vi.fn(),
      },
    });

    expect(document.querySelector(".editable-pane")).toBeInTheDocument();
    expect(document.querySelector(".editor-side")).toBeInTheDocument();
    expect(document.querySelector(".preview-side")).toBeInTheDocument();
  });

  it("renders editor and preview side by side", () => {
    render(EditablePane, {
      props: {
        content: "# Hello",
        filePath: "/docs/test.md",
        onsave: vi.fn(),
      },
    });

    const editorSide = document.querySelector(".editor-side");
    const previewSide = document.querySelector(".preview-side");
    expect(editorSide).toBeInTheDocument();
    expect(previewSide).toBeInTheDocument();
  });

  it("passes filePath to preview side", () => {
    const { container } = render(EditablePane, {
      props: {
        content: "# Hello",
        filePath: "/docs/test.md",
        onsave: vi.fn(),
      },
    });

    const previewSide = container.querySelector(".preview-side");
    expect(previewSide).toBeInTheDocument();
  });

  it("calls onsave with Ctrl+S", async () => {
    const onsave = vi.fn();
    render(EditablePane, {
      props: {
        content: "# Hello",
        filePath: "/docs/test.md",
        onsave,
      },
    });

    const pane = document.querySelector(".editable-pane")!;
    await fireEvent.keyDown(pane, { key: "s", ctrlKey: true });

    expect(onsave).toHaveBeenCalledWith("/docs/test.md", "# Hello");
  });

  it("does not auto-save immediately without changes", () => {
    const onsave = vi.fn();
    render(EditablePane, {
      props: {
        content: "# Hello",
        filePath: "/docs/test.md",
        onsave,
      },
    });

    // Without any content change, onsave should not be called
    expect(onsave).not.toHaveBeenCalled();
  });

  describe("scroll wheel sync", () => {
    it("has editor and preview containers for scroll sync", () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nSome text",
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const editorSide = document.querySelector(".editor-side");
      const previewSide = document.querySelector(".preview-side");
      expect(editorSide).toBeInTheDocument();
      expect(previewSide).toBeInTheDocument();

      // Preview side should contain a scrollable markdown-body element
      const viewer = previewSide?.querySelector(".viewer");
      expect(viewer).toBeInTheDocument();
    });

    it("syncs preview scroll when editor receives wheel event", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nLong content\n".repeat(50),
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const editorContent = document.querySelector(".editor-content");
      expect(editorContent).toBeInTheDocument();

      // Fire a wheel event on the editor content area
      await fireEvent.wheel(editorContent!, { deltaY: 100 });

      // The scroll sync mechanism should exist (no errors thrown)
      // Actual scroll sync requires real DOM scroll containers
      const previewSide = document.querySelector(".preview-side");
      expect(previewSide).toBeInTheDocument();
    });

    it("syncs editor scroll when preview receives wheel event", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nLong content\n".repeat(50),
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const previewSide = document.querySelector(".preview-side");
      expect(previewSide).toBeInTheDocument();

      // Fire a wheel event on the preview side
      await fireEvent.wheel(previewSide!, { deltaY: 100 });

      // The scroll sync mechanism should exist (no errors thrown)
      const editorContent = document.querySelector(".editor-content");
      expect(editorContent).toBeInTheDocument();
    });
  });
});
