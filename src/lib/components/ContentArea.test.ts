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

    expect(screen.getByText("Planning Central")).toBeInTheDocument();
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
      expect(screen.getByTitle("Close pane")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByTitle("Close pane"));
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
});
