import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/svelte";

// Use vi.hoisted so mock functions are available when vi.mock runs (hoisted above imports)
const {
  mockDestroy,
  mockDispatch,
  MockEditorView,
  mockUpdateListenerOf,
  captured,
} = vi.hoisted(() => {
  const mockDestroy = vi.fn();
  const mockDispatch = vi.fn();
  const captured: {
    parent?: HTMLElement;
    updateListener?: (update: any) => void;
    doc?: string;
  } = {};

  // Must use regular function (not arrow) so it can be called with `new`
  const MockEditorView = vi.fn().mockImplementation(function (this: any, config: any) {
    captured.parent = config.parent;
    captured.doc = config.state?.doc;
    this.destroy = mockDestroy;
    this.dispatch = mockDispatch;
  });

  const mockUpdateListenerOf = vi.fn().mockImplementation((cb: any) => {
    captured.updateListener = cb;
    return "updateListener";
  });

  return { mockDestroy, mockDispatch, MockEditorView, mockUpdateListenerOf, captured };
});

vi.mock("@codemirror/view", () => ({
  EditorView: Object.assign(MockEditorView, {
    updateListener: { of: mockUpdateListenerOf },
    theme: vi.fn().mockReturnValue("customTheme"),
    scrollIntoView: vi.fn().mockReturnValue({ type: "scrollIntoView" }),
    decorations: { from: vi.fn().mockReturnValue("decorationsFrom") },
  }),
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

import MarkdownEditor from "./MarkdownEditor.svelte";

beforeEach(() => {
  MockEditorView.mockClear();
  mockDestroy.mockClear();
  mockDispatch.mockClear();
  mockUpdateListenerOf.mockClear();
  captured.parent = undefined;
  captured.updateListener = undefined;
  captured.doc = undefined;
});

describe("MarkdownEditor", () => {
  it("renders an editor container element", () => {
    render(MarkdownEditor, {
      props: { content: "# Hello", onchange: vi.fn() },
    });

    expect(document.querySelector(".markdown-editor")).toBeInTheDocument();
  });

  it("creates EditorView with provided content", async () => {
    render(MarkdownEditor, {
      props: { content: "# Test Content", onchange: vi.fn() },
    });

    await vi.waitFor(() => {
      expect(MockEditorView).toHaveBeenCalled();
      expect(captured.doc).toBe("# Test Content");
    });
  });

  it("calls onchange when document changes", async () => {
    const onchange = vi.fn();
    render(MarkdownEditor, {
      props: { content: "# Hello", onchange },
    });

    await vi.waitFor(() => {
      expect(captured.updateListener).toBeDefined();
    });

    // Simulate a document change via the updateListener
    captured.updateListener!({
      docChanged: true,
      state: { doc: { toString: () => "# Updated" } },
    });

    expect(onchange).toHaveBeenCalledWith("# Updated");
  });

  it("does not call onchange when document has not changed", async () => {
    const onchange = vi.fn();
    render(MarkdownEditor, {
      props: { content: "# Hello", onchange },
    });

    await vi.waitFor(() => {
      expect(captured.updateListener).toBeDefined();
    });

    // Simulate a non-document update (e.g., selection change)
    captured.updateListener!({
      docChanged: false,
      state: { doc: { toString: () => "# Hello" } },
    });

    expect(onchange).not.toHaveBeenCalled();
  });

  it("re-dispatches search highlight when content changes while highlightText is set", async () => {
    // Scenario: user clicks a search result for a NEW file.
    // highlightText is set synchronously, but content loads async.
    // The search effect must re-fire when content arrives.

    // Mock doc that starts empty and gets updated when "file loads"
    let docContent = "";
    let docLines = 0;
    const mockDoc = {
      get lines() { return docLines; },
      line: vi.fn().mockImplementation(() => ({ from: 0, text: "" })),
      lineAt: vi.fn().mockReturnValue({ text: "", number: 1, from: 0 }),
      toString: () => docContent,
      get length() { return docContent.length; },
    };

    const originalImpl = MockEditorView.getMockImplementation();
    MockEditorView.mockImplementation(function (this: any, config: any) {
      captured.parent = config.parent;
      captured.doc = config.state?.doc;
      this.destroy = mockDestroy;
      this.dispatch = mockDispatch;
      this.state = { doc: mockDoc };
    });

    // Render with empty content but active search text
    const { rerender } = render(MarkdownEditor, {
      props: { content: "", highlightText: "hello", highlightKey: 1 },
    });

    await vi.waitFor(() => expect(MockEditorView).toHaveBeenCalledTimes(1));

    // Initial: doc is empty → search dispatches setSearchText but no scrollIntoView
    const initialScrolls = mockDispatch.mock.calls.filter(
      (c: any) => c[0]?.effects?.some?.((e: any) => e.type === "scrollIntoView")
    );
    expect(initialScrolls.length).toBe(0);

    // Clear and prepare for "file load"
    mockDispatch.mockClear();
    mockDestroy.mockClear();

    // Update mock doc to contain the search text
    docContent = "line with hello world";
    docLines = 1;
    mockDoc.line = vi.fn().mockReturnValue({ from: 0, text: "line with hello world" });
    mockDoc.lineAt = vi.fn().mockReturnValue({ text: "line with hello world", number: 1, from: 0 });

    // Rerender with new content (same highlightText & highlightKey)
    await rerender({ content: "line with hello world", highlightText: "hello", highlightKey: 1 });
    await new Promise((r) => setTimeout(r, 20));

    // Check if rerender remounted the component
    const remounted = mockDestroy.mock.calls.length > 0;

    // Verify scrollIntoView was dispatched after content change
    const hasScroll = mockDispatch.mock.calls.some(
      (c: any) => c[0]?.effects?.some?.((e: any) => e.type === "scrollIntoView")
    );

    if (!remounted) {
      // True prop-update test: search effect must track content
      expect(hasScroll).toBe(true);
    } else {
      // Remount: effects run fresh with full props — always finds match
      expect(hasScroll).toBe(true);
    }

    if (originalImpl) MockEditorView.mockImplementation(originalImpl);
  });
});
