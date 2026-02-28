import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import FileTree from "./FileTree.svelte";
import type { FileEntry } from "../types";

const fileEntries: FileEntry[] = [
  { name: "readme.md", path: "/readme.md", is_directory: false, children: [] },
  { name: "plan.md", path: "/plan.md", is_directory: false, children: [] },
  { name: "notes.md", path: "/notes.md", is_directory: false, children: [] },
];

const mixedEntries: FileEntry[] = [
  {
    name: "docs",
    path: "/docs",
    is_directory: true,
    children: [
      { name: "note.md", path: "/docs/note.md", is_directory: false, children: [] },
    ],
  },
  { name: "readme.md", path: "/readme.md", is_directory: false, children: [] },
];

describe("FileTree", () => {
  it("shows empty message when no entries", () => {
    render(FileTree, {
      props: { entries: [], selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByText("No markdown files found.")).toBeInTheDocument();
  });

  it("renders file entries", () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByText("plan.md")).toBeInTheDocument();
  });

  it("renders directory entries", () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("has tree role for accessibility", () => {
    render(FileTree, {
      props: { entries: [], selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByRole("tree")).toBeInTheDocument();
  });
});

describe("FileTree keyboard navigation", () => {
  it("ArrowDown moves focus to first item when nothing focused", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" });

    // First item should have the focused class
    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[0].classList.contains("focused")).toBe(true);
  });

  it("ArrowDown moves focus to next item", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" });
    await fireEvent.keyDown(tree, { key: "ArrowDown" });

    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[0].classList.contains("focused")).toBe(false);
    expect(buttons[1].classList.contains("focused")).toBe(true);
  });

  it("ArrowUp moves focus to previous item", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    // Go down twice, then up once
    await fireEvent.keyDown(tree, { key: "ArrowDown" });
    await fireEvent.keyDown(tree, { key: "ArrowDown" });
    await fireEvent.keyDown(tree, { key: "ArrowUp" });

    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[0].classList.contains("focused")).toBe(true);
    expect(buttons[1].classList.contains("focused")).toBe(false);
  });

  it("ArrowDown does not go past last item", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    // Go down 10 times (only 3 items)
    for (let i = 0; i < 10; i++) {
      await fireEvent.keyDown(tree, { key: "ArrowDown" });
    }

    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[2].classList.contains("focused")).toBe(true);
  });

  it("ArrowUp does not go before first item", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus first
    await fireEvent.keyDown(tree, { key: "ArrowUp" }); // try to go before

    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[0].classList.contains("focused")).toBe(true);
  });

  it("ArrowDown auto-selects files", async () => {
    const onselect = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus readme.md

    expect(onselect).toHaveBeenCalledWith("/readme.md");
  });

  it("ArrowUp auto-selects files", async () => {
    const onselect = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // readme.md
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // plan.md
    await fireEvent.keyDown(tree, { key: "ArrowUp" }); // back to readme.md

    expect(onselect).toHaveBeenLastCalledWith("/readme.md");
  });

  it("ArrowDown does not auto-select directories", async () => {
    const onselect = vi.fn();
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus docs (directory)

    // Should NOT call onselect for a directory
    expect(onselect).not.toHaveBeenCalled();
  });

  it("Enter selects the focused file", async () => {
    const onselect = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus readme.md
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus plan.md
    await fireEvent.keyDown(tree, { key: "Enter" });

    expect(onselect).toHaveBeenLastCalledWith("/plan.md");
  });

  it("Enter toggles directory expansion", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus docs dir

    // docs starts expanded (depth 0), so Enter should collapse it
    await fireEvent.keyDown(tree, { key: "Enter" });

    // After collapsing, "note.md" should not be visible
    expect(screen.queryByText("note.md")).not.toBeInTheDocument();
  });
});

describe("FileTree focus initialization", () => {
  it("initializes focusedPath to selectedPath on focus when selectedPath is set", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "/plan.md", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.focus(tree);

    // plan.md (2nd item) should be focused since it's the selectedPath
    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[1].classList.contains("focused")).toBe(true);
  });

  it("initializes focusedPath to first visible item on focus when no selectedPath", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.focus(tree);

    // First item should be focused
    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[0].classList.contains("focused")).toBe(true);
  });

  it("does not reset focusedPath on focus if already set", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    // Navigate to second item
    await fireEvent.keyDown(tree, { key: "ArrowDown" });
    await fireEvent.keyDown(tree, { key: "ArrowDown" });

    // Blur and re-focus
    await fireEvent.blur(tree);
    await fireEvent.focus(tree);

    // Should still be on second item, not reset to first
    const buttons = tree.querySelectorAll("button.tree-row");
    expect(buttons[1].classList.contains("focused")).toBe(true);
  });
});
