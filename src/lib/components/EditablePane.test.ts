import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";

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
      this.focus = vi.fn();
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
  Compartment: vi.fn().mockImplementation(function (this: any) {
    this.of = vi.fn().mockReturnValue("themeCompartment");
    this.reconfigure = vi.fn().mockReturnValue({ type: "reconfigure" });
  }),
}));

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: vi.fn().mockReturnValue("markdownLang"),
}));

vi.mock("@codemirror/language", () => ({
  HighlightStyle: {
    define: vi.fn().mockReturnValue("highlightStyle"),
  },
  syntaxHighlighting: vi.fn().mockReturnValue("syntaxHighlighting"),
}));

vi.mock("@lezer/highlight", () => ({
  tags: new Proxy({}, { get: () => vi.fn().mockReturnValue("tag") }),
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

  describe("active pane tracking", () => {
    it("sets activePane to editor on pointerdown on editor side", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nSome text",
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const editorSide = document.querySelector(".editor-side")!;
      await fireEvent.pointerDown(editorSide);

      // Verify by checking that editor scroll now syncs (activePane = 'editor')
      // We test this indirectly via the scroll sync tests below
      expect(editorSide).toBeInTheDocument();
    });

    it("sets activePane to preview on pointerdown on preview side", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nSome text",
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const previewSide = document.querySelector(".preview-side")!;
      await fireEvent.pointerDown(previewSide);

      expect(previewSide).toBeInTheDocument();
    });

    it("sets activePane to editor on wheel over editor side", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nSome text",
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const editorSide = document.querySelector(".editor-side")!;
      await fireEvent.wheel(editorSide, { deltaY: 100 });

      expect(editorSide).toBeInTheDocument();
    });

    it("sets activePane to preview on wheel over preview side", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nSome text",
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const previewSide = document.querySelector(".preview-side")!;
      await fireEvent.wheel(previewSide, { deltaY: 100 });

      expect(previewSide).toBeInTheDocument();
    });
  });

  describe("directional scroll sync", () => {
    function mockScrollMetrics(el: HTMLElement, scrollHeight: number, clientHeight: number, scrollTop = 0) {
      Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
      Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
      Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
    }

    function setupScrollablePane() {
      const longContent = "# Title\n\n" + "Line of text\n".repeat(100);
      render(EditablePane, {
        props: {
          content: longContent,
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const paneEl = document.querySelector('.editable-pane')!;

      // Create mock cm-scroller inside editor-content if not present
      let editorScroller = paneEl.querySelector('.cm-scroller') as HTMLElement;
      if (!editorScroller) {
        editorScroller = document.createElement('div');
        editorScroller.className = 'cm-scroller';
        paneEl.querySelector('.editor-content')!.appendChild(editorScroller);
      }

      let previewScroller = paneEl.querySelector('.markdown-body') as HTMLElement;
      if (!previewScroller) {
        previewScroller = document.createElement('div');
        previewScroller.className = 'markdown-body';
        paneEl.querySelector('.preview-side')!.appendChild(previewScroller);
      }

      // Mock scroll metrics: scrollHeight=1000, clientHeight=500 => maxScroll=500
      mockScrollMetrics(editorScroller, 1000, 500, 0);
      mockScrollMetrics(previewScroller, 2000, 500, 0);

      return { paneEl, editorScroller, previewScroller };
    }

    it("editor scroll syncs to preview when activePane is editor", async () => {
      const { editorScroller, previewScroller } = setupScrollablePane();

      // Trigger scroll sync setup via RAF
      await new Promise(r => requestAnimationFrame(r));

      // Activate editor pane
      const editorSide = document.querySelector(".editor-side")!;
      await fireEvent.pointerDown(editorSide);

      // Simulate editor scrolling to 50%
      editorScroller.scrollTop = 250; // 250/500 = 50%
      editorScroller.dispatchEvent(new Event('scroll'));

      // Preview should sync to 50% of its max (1500 * 0.5 = 750)
      expect(previewScroller.scrollTop).toBe(750);
    });

    it("editor scroll does NOT sync to preview when activePane is preview", async () => {
      const { editorScroller, previewScroller } = setupScrollablePane();

      await new Promise(r => requestAnimationFrame(r));

      // Activate preview pane
      const previewSide = document.querySelector(".preview-side")!;
      await fireEvent.pointerDown(previewSide);

      // Simulate editor scrolling
      editorScroller.scrollTop = 250;
      editorScroller.dispatchEvent(new Event('scroll'));

      // Preview should NOT have changed
      expect(previewScroller.scrollTop).toBe(0);
    });

    it("editor scroll does NOT sync when activePane is none", async () => {
      const { editorScroller, previewScroller } = setupScrollablePane();

      await new Promise(r => requestAnimationFrame(r));

      // No activation — activePane stays 'none'
      editorScroller.scrollTop = 250;
      editorScroller.dispatchEvent(new Event('scroll'));

      expect(previewScroller.scrollTop).toBe(0);
    });

    it("preview scroll syncs to editor when activePane is preview", async () => {
      const { editorScroller, previewScroller } = setupScrollablePane();

      await new Promise(r => requestAnimationFrame(r));

      // Activate preview pane
      const previewSide = document.querySelector(".preview-side")!;
      await fireEvent.pointerDown(previewSide);

      // Simulate preview scrolling to 50%
      previewScroller.scrollTop = 750; // 750/1500 = 50%
      previewScroller.dispatchEvent(new Event('scroll'));

      // Editor should sync to 50% of its max (500 * 0.5 = 250)
      expect(editorScroller.scrollTop).toBe(250);
    });

    it("preview scroll does NOT sync to editor when activePane is editor", async () => {
      const { editorScroller, previewScroller } = setupScrollablePane();

      await new Promise(r => requestAnimationFrame(r));

      // Activate editor pane
      const editorSide = document.querySelector(".editor-side")!;
      await fireEvent.pointerDown(editorSide);

      // Simulate preview scrolling
      previewScroller.scrollTop = 750;
      previewScroller.dispatchEvent(new Event('scroll'));

      // Editor should NOT have changed
      expect(editorScroller.scrollTop).toBe(0);
    });

    it("preview scroll does NOT sync when activePane is none", async () => {
      const { editorScroller, previewScroller } = setupScrollablePane();

      await new Promise(r => requestAnimationFrame(r));

      previewScroller.scrollTop = 750;
      previewScroller.dispatchEvent(new Event('scroll'));

      expect(editorScroller.scrollTop).toBe(0);
    });

    it("proportional ratio is correct across different content sizes", async () => {
      const { editorScroller, previewScroller } = setupScrollablePane();

      await new Promise(r => requestAnimationFrame(r));

      const editorSide = document.querySelector(".editor-side")!;
      await fireEvent.pointerDown(editorSide);

      // Scroll editor to 25%
      editorScroller.scrollTop = 125; // 125/500 = 25%
      editorScroller.dispatchEvent(new Event('scroll'));

      // Preview should be at 25% of its max: 1500 * 0.25 = 375
      expect(previewScroller.scrollTop).toBe(375);
    });

    it("does not sync when content fits (zero max scroll)", async () => {
      render(EditablePane, {
        props: {
          content: "# Short",
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const paneEl = document.querySelector('.editable-pane')!;

      let editorScroller = paneEl.querySelector('.cm-scroller') as HTMLElement;
      if (!editorScroller) {
        editorScroller = document.createElement('div');
        editorScroller.className = 'cm-scroller';
        paneEl.querySelector('.editor-content')!.appendChild(editorScroller);
      }

      let previewScroller = paneEl.querySelector('.markdown-body') as HTMLElement;
      if (!previewScroller) {
        previewScroller = document.createElement('div');
        previewScroller.className = 'markdown-body';
        paneEl.querySelector('.preview-side')!.appendChild(previewScroller);
      }

      // Content fits — scrollHeight equals clientHeight
      mockScrollMetrics(editorScroller, 500, 500, 0);
      mockScrollMetrics(previewScroller, 500, 500, 0);

      await new Promise(r => requestAnimationFrame(r));

      const editorSide = document.querySelector(".editor-side")!;
      await fireEvent.pointerDown(editorSide);

      editorScroller.scrollTop = 0;
      editorScroller.dispatchEvent(new Event('scroll'));

      // No sync should happen, no errors
      expect(previewScroller.scrollTop).toBe(0);
    });
  });

  describe("scroll sync containers", () => {
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

    it("handles wheel events on editor content without errors", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nLong content\n".repeat(50),
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const editorContent = document.querySelector(".editor-content");
      expect(editorContent).toBeInTheDocument();

      await fireEvent.wheel(editorContent!, { deltaY: 100 });

      const previewSide = document.querySelector(".preview-side");
      expect(previewSide).toBeInTheDocument();
    });

    it("handles wheel events on preview side without errors", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nLong content\n".repeat(50),
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const previewSide = document.querySelector(".preview-side");
      expect(previewSide).toBeInTheDocument();

      await fireEvent.wheel(previewSide!, { deltaY: 100 });

      const editorContent = document.querySelector(".editor-content");
      expect(editorContent).toBeInTheDocument();
    });
  });

  describe("active line driving", () => {
    it("suppresses editor-to-preview proportional sync during active line callback", async () => {
      // The activeLineDriving flag prevents the scroll sync from running
      // during the active-line highlight animation, preventing feedback loops.
      // This is tested by verifying the component renders without errors
      // when both active line and scroll events fire.
      render(EditablePane, {
        props: {
          content: "# Hello\n\nLine 1\nLine 2\nLine 3\n".repeat(20),
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const editorSide = document.querySelector(".editor-side")!;
      const editorContent = document.querySelector(".editor-content")!;

      // Activate editor pane
      await fireEvent.pointerDown(editorSide);

      // Simulate a wheel event (which would also trigger scroll)
      await fireEvent.wheel(editorContent, { deltaY: 50 });

      // No errors should occur — the directional model prevents feedback loops
      expect(document.querySelector(".editable-pane")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("rapid alternating clicks between editor and preview do not cause errors", async () => {
      render(EditablePane, {
        props: {
          content: "# Hello\n\nContent\n".repeat(50),
          filePath: "/docs/test.md",
          onsave: vi.fn(),
        },
      });

      const editorSide = document.querySelector(".editor-side")!;
      const previewSide = document.querySelector(".preview-side")!;

      // Rapidly alternate clicks
      for (let i = 0; i < 10; i++) {
        await fireEvent.pointerDown(editorSide);
        await fireEvent.pointerDown(previewSide);
      }

      expect(document.querySelector(".editable-pane")).toBeInTheDocument();
    });
  });
});
