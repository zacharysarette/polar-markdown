import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";

// Mock mermaid
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock filesystem (renderAsciiDiagram)
vi.mock("../services/filesystem", () => ({
  renderAsciiDiagram: vi.fn(),
}));

// Mock CodeMirror modules (needed by MarkdownEditor via EditablePane)
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

import ContentArea from "./ContentArea.svelte";
import type { OpenPane, LayoutMode } from "../types";

function makePane(id: string, path: string, content: string): OpenPane {
  return { id, path, content };
}

describe("ContentArea", () => {
  it("shows empty state when no panes", () => {
    render(ContentArea, {
      props: {
        panes: [],
        activePaneId: "",
        layoutMode: "centered" as LayoutMode,
      },
    });

    expect(screen.getByText("Polar Markdown")).toBeInTheDocument();
    expect(
      screen.getByText("Select a markdown file from the sidebar to view it.")
    ).toBeInTheDocument();
  });

  it("renders a single pane with filename", async () => {
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(document.querySelector(".pane-filename")?.textContent?.trim()).toBe("readme.md");
    });
  });

  it("renders multiple panes side by side", async () => {
    render(ContentArea, {
      props: {
        panes: [
          makePane("1", "/docs/readme.md", "# README"),
          makePane("2", "/docs/plan.md", "# Plan"),
        ],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      const filenames = document.querySelectorAll(".pane-filename");
      expect(filenames).toHaveLength(2);
      expect(filenames[0].textContent?.trim()).toBe("readme.md");
      expect(filenames[1].textContent?.trim()).toBe("plan.md");
    });
  });

  it("calls onclosepane when X button clicked", async () => {
    const onclose = vi.fn();
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
        onclosepane: onclose,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Close pane (Ctrl+W)")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByTitle("Close pane (Ctrl+W)"));
    expect(onclose).toHaveBeenCalledWith("1");
  });

  it("marks active pane with active class", async () => {
    render(ContentArea, {
      props: {
        panes: [
          makePane("1", "/docs/readme.md", "# README"),
          makePane("2", "/docs/plan.md", "# Plan"),
        ],
        activePaneId: "2",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      const panes = document.querySelectorAll(".pane");
      expect(panes).toHaveLength(2);
      expect(panes[0].classList.contains("active")).toBe(false);
      expect(panes[1].classList.contains("active")).toBe(true);
    });
  });

  it("calls onactivatepane when pane is clicked", async () => {
    const onactivate = vi.fn();
    render(ContentArea, {
      props: {
        panes: [
          makePane("1", "/docs/readme.md", "# README"),
          makePane("2", "/docs/plan.md", "# Plan"),
        ],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
        onactivatepane: onactivate,
      },
    });

    await vi.waitFor(() => {
      const filenames = document.querySelectorAll(".pane-filename");
      expect(filenames).toHaveLength(2);
    });

    // Click on the second pane
    const paneElements = document.querySelectorAll(".pane");
    await fireEvent.click(paneElements[1]);
    expect(onactivate).toHaveBeenCalledWith("2");
  });

  it("renders view and edit mode toggle buttons in pane header", async () => {
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("View Mode (Ctrl+E)")).toBeInTheDocument();
      expect(screen.getByTitle("Edit Mode (Ctrl+E)")).toBeInTheDocument();
    });
  });

  it("calls ontoggleedit when edit mode button is clicked", async () => {
    const ontoggleedit = vi.fn();
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
        ontoggleedit,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Edit Mode (Ctrl+E)")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByTitle("Edit Mode (Ctrl+E)"));
    expect(ontoggleedit).toHaveBeenCalledWith("1");
  });

  it("renders MarkdownViewer for pane in view mode", async () => {
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    // In view mode, should NOT have editable-pane class
    await vi.waitFor(() => {
      expect(document.querySelector(".editable-pane")).not.toBeInTheDocument();
    });
  });

  it("shows read-only badge and hides edit toggle for readOnly pane", async () => {
    render(ContentArea, {
      props: {
        panes: [{ id: "1", path: "Help.md", content: "# Help", readOnly: true }],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByText("Read Only")).toBeInTheDocument();
      expect(screen.queryByTitle("Edit Mode (Ctrl+E)")).not.toBeInTheDocument();
      expect(screen.queryByTitle("View Mode (Ctrl+E)")).not.toBeInTheDocument();
    });
  });

  it("renders EditablePane for pane in edit mode", async () => {
    render(ContentArea, {
      props: {
        panes: [{ id: "1", path: "/docs/readme.md", content: "# Hello", editMode: true }],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(document.querySelector(".editable-pane")).toBeInTheDocument();
    });
  });

  it("renders Save As button for non-readOnly pane", async () => {
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Save As (Ctrl+Shift+S)")).toBeInTheDocument();
    });
  });

  it("does not render Save As button for readOnly pane", async () => {
    render(ContentArea, {
      props: {
        panes: [{ id: "1", path: "Help.md", content: "# Help", readOnly: true }],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByText("Read Only")).toBeInTheDocument();
    });
    expect(screen.queryByTitle("Save As (Ctrl+Shift+S)")).not.toBeInTheDocument();
  });

  it("calls onsaveas with pane id when Save As button clicked", async () => {
    const onsaveas = vi.fn();
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
        onsaveas,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Save As (Ctrl+Shift+S)")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByTitle("Save As (Ctrl+Shift+S)"));
    expect(onsaveas).toHaveBeenCalledWith("1");
  });

  it("renders copy path button in pane header", async () => {
    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Copy file path")).toBeInTheDocument();
    });
  });

  it("calls navigator.clipboard.writeText when copy button clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true, configurable: true });

    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Copy file path")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByTitle("Copy file path"));
    expect(writeText).toHaveBeenCalledWith("/docs/readme.md");
  });

  it("shows checkmark SVG after copy and reverts after timeout", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true, configurable: true });

    render(ContentArea, {
      props: {
        panes: [makePane("1", "/docs/readme.md", "# Hello")],
        activePaneId: "1",
        layoutMode: "centered" as LayoutMode,
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Copy file path")).toBeInTheDocument();
    });

    const btn = screen.getByTitle("Copy file path");
    // Before click: clipboard icon (rect element)
    expect(btn.querySelector("rect")).toBeTruthy();
    expect(btn.querySelector("polyline")).toBeFalsy();

    await fireEvent.click(btn);

    // After click: checkmark icon (polyline element)
    await vi.waitFor(() => {
      expect(btn.querySelector("polyline")).toBeTruthy();
      expect(btn.querySelector("rect")).toBeFalsy();
    });

    // After timeout: reverts to clipboard icon
    vi.advanceTimersByTime(1500);
    await vi.waitFor(() => {
      expect(btn.querySelector("rect")).toBeTruthy();
      expect(btn.querySelector("polyline")).toBeFalsy();
    });

    vi.useRealTimers();
  });
});
