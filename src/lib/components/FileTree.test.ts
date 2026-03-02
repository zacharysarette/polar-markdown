import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import FileTree from "./FileTree.svelte";
import type { FileEntry } from "../types";

beforeEach(() => {
  localStorage.clear();
});

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

    // docs starts collapsed, so note.md should not be visible
    expect(screen.queryByText("note.md")).not.toBeInTheDocument();

    // Enter should expand it
    await fireEvent.keyDown(tree, { key: "Enter" });
    expect(screen.getByText("note.md")).toBeInTheDocument();

    // Enter again should collapse it
    await fireEvent.keyDown(tree, { key: "Enter" });
    expect(screen.queryByText("note.md")).not.toBeInTheDocument();
  });
});

describe("FileTree onfocuschange callback", () => {
  it("ArrowDown calls onfocuschange with focused path", async () => {
    const onfocuschange = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), onfocuschange },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" });

    expect(onfocuschange).toHaveBeenCalledWith("/readme.md");
  });

  it("ArrowUp calls onfocuschange with focused path", async () => {
    const onfocuschange = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), onfocuschange },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" });
    await fireEvent.keyDown(tree, { key: "ArrowDown" });
    await fireEvent.keyDown(tree, { key: "ArrowUp" });

    expect(onfocuschange).toHaveBeenLastCalledWith("/readme.md");
  });

  it("works without onfocuschange prop", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const tree = screen.getByRole("tree");
    // Should not throw
    await fireEvent.keyDown(tree, { key: "ArrowDown" });
    await fireEvent.keyDown(tree, { key: "ArrowUp" });
  });
});

describe("FileTree drag-and-drop", () => {
  it("file items are draggable", () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const buttons = document.querySelectorAll("button.tree-row");
    expect(buttons[0].getAttribute("draggable")).toBe("true");
  });

  it("directory items are not draggable", () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    // First button is the "docs" directory
    const buttons = document.querySelectorAll("button.tree-row");
    expect(buttons[0].getAttribute("draggable")).toBe("false");
  });

  it("dragstart sets text/plain data with file path", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn() },
    });

    const button = document.querySelector("button.tree-row") as HTMLElement;
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(button, { dataTransfer });

    expect(dataTransfer.getData("text/plain")).toBe("/readme.md");
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

describe("FileTree F2 rename", () => {
  it("F2 calls onstartrename with focused file path", async () => {
    const onstartrename = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), onstartrename },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus readme.md
    await fireEvent.keyDown(tree, { key: "F2" });

    expect(onstartrename).toHaveBeenCalledWith("/readme.md");
  });

  it("F2 does not call onstartrename for directories", async () => {
    const onstartrename = vi.fn();
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn(), onstartrename },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus docs (directory)
    await fireEvent.keyDown(tree, { key: "F2" });

    expect(onstartrename).not.toHaveBeenCalled();
  });

  it("F2 does nothing when no file is focused", async () => {
    const onstartrename = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), onstartrename },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "F2" });

    expect(onstartrename).not.toHaveBeenCalled();
  });
});

describe("FileTree inline rename", () => {
  it("shows rename input when renamingPath matches a file", () => {
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        renamingPath: "/readme.md",
      },
    });

    expect(screen.getByTestId("rename-input")).toBeInTheDocument();
  });

  it("does not show rename input when renamingPath does not match", () => {
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        renamingPath: "",
      },
    });

    expect(screen.queryByTestId("rename-input")).not.toBeInTheDocument();
  });

  it("calls onconfirmrename on Enter in rename input", async () => {
    const onconfirmrename = vi.fn();
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        renamingPath: "/readme.md",
        onconfirmrename,
      },
    });

    const input = screen.getByTestId("rename-input");
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(onconfirmrename).toHaveBeenCalledWith("/readme.md", "readme.md");
  });

  it("calls oncancelrename on Escape in rename input", async () => {
    const oncancelrename = vi.fn();
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        renamingPath: "/readme.md",
        oncancelrename,
      },
    });

    const input = screen.getByTestId("rename-input");
    await fireEvent.keyDown(input, { key: "Escape" });

    expect(oncancelrename).toHaveBeenCalledOnce();
  });

  it("shows rename error when renameError is set", () => {
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        renamingPath: "/readme.md",
        renameError: "File already exists",
      },
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("File already exists");
  });

  it("does not show rename error when renameError is empty", () => {
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        renamingPath: "/readme.md",
        renameError: "",
      },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("FileTree context menu", () => {
  it("shows context menu on right-click of a file item", async () => {
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        onstartrename: vi.fn(),
      },
    });

    const button = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    expect(screen.getByText("Rename")).toBeInTheDocument();
  });

  it("calls onstartrename when Rename menu item is clicked", async () => {
    const onstartrename = vi.fn();
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        onstartrename,
      },
    });

    const button = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    const renameBtn = screen.getByText("Rename");
    await fireEvent.click(renameBtn);

    expect(onstartrename).toHaveBeenCalledWith("/readme.md");
  });

  it("does not show context menu for directories", async () => {
    render(FileTree, {
      props: {
        entries: mixedEntries,
        selectedPath: "",
        onselect: vi.fn(),
        onstartrename: vi.fn(),
      },
    });

    const button = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    expect(screen.queryByText("Rename")).not.toBeInTheDocument();
  });
});

describe("FileTree expansion persistence", () => {
  it("directories start collapsed by default", () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    // Children of collapsed directory should not be visible
    expect(screen.queryByText("note.md")).not.toBeInTheDocument();
  });

  it("restores expansion state from localStorage", () => {
    localStorage.setItem(
      "polar-markdown:expanded-paths",
      JSON.stringify(["/docs"])
    );

    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    // docs was saved as expanded, so its child should be visible
    expect(screen.getByText("note.md")).toBeInTheDocument();
  });
});
