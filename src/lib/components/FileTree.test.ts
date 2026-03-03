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

  it("directory items are draggable", () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    // First button is the "docs" directory
    const buttons = document.querySelectorAll("button.tree-row");
    expect(buttons[0].getAttribute("draggable")).toBe("true");
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

  it("dragstart on a directory sets text/plain data with dir path", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const button = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    const dataTransfer = new DataTransfer();
    await fireEvent.dragStart(button, { dataTransfer });

    expect(dataTransfer.getData("text/plain")).toBe("/docs");
  });

  it("dragOver on a directory calls preventDefault", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const dirButton = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    const event = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { dropEffect: "" } });
    const prevented = !dirButton.dispatchEvent(event);

    expect(prevented).toBe(true);
  });

  it("dragOver on a directory sets dropEffect to move", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const dirButton = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    const dt = { dropEffect: "" };
    const event = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dt });
    dirButton.dispatchEvent(event);

    expect(dt.dropEffect).toBe("move");
  });

  it("dragOver on a file still calls preventDefault (prevents WebView2 navigation)", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const fileButton = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    const event = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { dropEffect: "" } });
    const prevented = !fileButton.dispatchEvent(event);

    expect(prevented).toBe(true);
  });

  it("dragOver on a file does NOT set dropEffect or add drag-over class", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const fileButton = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    const dt = { dropEffect: "" };
    await fireEvent.dragOver(fileButton, { dataTransfer: dt });

    // dropEffect should NOT be set (stays empty) for file items
    expect(dt.dropEffect).toBe("");
    // drag-over class should NOT appear on file items
    expect(fileButton.classList.contains("drag-over")).toBe(false);
  });

  it("drop on a directory calls onmovefile with source path and dir path", async () => {
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn(), onmovefile },
    });

    const fileButton = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    const dirButton = document.querySelector('button[data-path="/docs"]') as HTMLElement;

    // Simulate dragStart on the file
    const startTransfer = new DataTransfer();
    await fireEvent.dragStart(fileButton, { dataTransfer: startTransfer });

    // Simulate drop on the directory
    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/readme.md");
    await fireEvent.drop(dirButton, { dataTransfer: dropTransfer });

    expect(onmovefile).toHaveBeenCalledWith("/readme.md", "/docs");
  });

  it("drop on a file calls preventDefault but does not call onmovefile", async () => {
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), onmovefile },
    });

    const fileButton = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { getData: () => "/plan.md" },
    });
    const prevented = !fileButton.dispatchEvent(event);

    expect(prevented).toBe(true);
    expect(onmovefile).not.toHaveBeenCalled();
  });

  it("drop with same path as target does NOT call onmovefile", async () => {
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn(), onmovefile },
    });

    const dirButton = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/docs");
    await fireEvent.drop(dirButton, { dataTransfer: dropTransfer });

    expect(onmovefile).not.toHaveBeenCalled();
  });

  it("drag-over CSS class appears on dragOver and disappears on dragLeave", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const dirButton = document.querySelector('button[data-path="/docs"]') as HTMLElement;

    await fireEvent.dragOver(dirButton, { dataTransfer: { dropEffect: "" } });
    expect(dirButton.classList.contains("drag-over")).toBe(true);

    await fireEvent.dragLeave(dirButton);
    expect(dirButton.classList.contains("drag-over")).toBe(false);
  });

  it("drag-over CSS class disappears on drop", async () => {
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn() },
    });

    const dirButton = document.querySelector('button[data-path="/docs"]') as HTMLElement;

    await fireEvent.dragOver(dirButton, { dataTransfer: { dropEffect: "" } });
    expect(dirButton.classList.contains("drag-over")).toBe(true);

    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/readme.md");
    await fireEvent.drop(dirButton, { dataTransfer: dropTransfer });
    expect(dirButton.classList.contains("drag-over")).toBe(false);
  });

  it("drop folder on another folder calls onmovefile", async () => {
    const nestedEntries: FileEntry[] = [
      {
        name: "folderA",
        path: "/folderA",
        is_directory: true,
        children: [],
      },
      {
        name: "folderB",
        path: "/folderB",
        is_directory: true,
        children: [],
      },
    ];
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: nestedEntries, selectedPath: "", onselect: vi.fn(), onmovefile },
    });

    const folderB = document.querySelector('button[data-path="/folderB"]') as HTMLElement;
    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/folderA");
    await fireEvent.drop(folderB, { dataTransfer: dropTransfer });

    expect(onmovefile).toHaveBeenCalledWith("/folderA", "/folderB");
  });

  it("drop folder on itself does NOT call onmovefile", async () => {
    const nestedEntries: FileEntry[] = [
      {
        name: "folderA",
        path: "/folderA",
        is_directory: true,
        children: [],
      },
    ];
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: nestedEntries, selectedPath: "", onselect: vi.fn(), onmovefile },
    });

    const folder = document.querySelector('button[data-path="/folderA"]') as HTMLElement;
    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/folderA");
    await fireEvent.drop(folder, { dataTransfer: dropTransfer });

    expect(onmovefile).not.toHaveBeenCalled();
  });

  it("dragend resets dragSourcePath so stale state does not interfere", async () => {
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: mixedEntries, selectedPath: "", onselect: vi.fn(), onmovefile },
    });

    const fileButton = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    const dirButton = document.querySelector('button[data-path="/docs"]') as HTMLElement;

    // Start a drag
    const startTransfer = new DataTransfer();
    await fireEvent.dragStart(fileButton, { dataTransfer: startTransfer });

    // Fire dragend (simulates cancel/escape)
    await fireEvent.dragEnd(fileButton);

    // Now drop on directory — should NOT use stale dragSourcePath
    const dropTransfer = new DataTransfer();
    // DataTransfer is empty (no setData call) simulating WebView2 behavior
    await fireEvent.drop(dirButton, { dataTransfer: dropTransfer });

    // Should not call onmovefile since dragSourcePath was reset and DataTransfer is empty
    expect(onmovefile).not.toHaveBeenCalled();
  });

  it("drop folder on its own descendant does NOT call onmovefile", async () => {
    const nestedEntries: FileEntry[] = [
      {
        name: "parent",
        path: "/parent",
        is_directory: true,
        children: [
          {
            name: "child",
            path: "/parent/child",
            is_directory: true,
            children: [],
          },
        ],
      },
    ];
    const onmovefile = vi.fn();

    // Pre-expand parent so child is visible
    localStorage.setItem(
      "polar-markdown:expanded-paths",
      JSON.stringify(["/parent"])
    );

    render(FileTree, {
      props: { entries: nestedEntries, selectedPath: "", onselect: vi.fn(), onmovefile },
    });

    const childButton = document.querySelector('button[data-path="/parent/child"]') as HTMLElement;
    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/parent");
    await fireEvent.drop(childButton, { dataTransfer: dropTransfer });

    expect(onmovefile).not.toHaveBeenCalled();
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

  it("shows Save As in context menu on right-click of a file", async () => {
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        onsaveas: vi.fn(),
      },
    });

    const button = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    expect(screen.getByText("Save As")).toBeInTheDocument();
  });

  it("calls onsaveas when Save As menu item is clicked", async () => {
    const onsaveas = vi.fn();
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        onsaveas,
      },
    });

    const button = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    const saveAsBtn = screen.getByText("Save As");
    await fireEvent.click(saveAsBtn);

    expect(onsaveas).toHaveBeenCalledWith("/readme.md");
  });

  it("shows context menu for directories with Copy Path and Delete only", async () => {
    render(FileTree, {
      props: {
        entries: mixedEntries,
        selectedPath: "",
        onselect: vi.fn(),
        onstartrename: vi.fn(),
        ondelete: vi.fn(),
        onsaveas: vi.fn(),
        oncopypath: vi.fn(),
      },
    });

    const button = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    // Directories should show Copy Path and Delete but not Save As or Rename
    expect(screen.getByText("Copy Path")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.queryByText("Save As")).not.toBeInTheDocument();
    expect(screen.queryByText("Rename")).not.toBeInTheDocument();
  });

  it("calls ondelete when Delete is clicked in directory context menu", async () => {
    const ondelete = vi.fn();
    render(FileTree, {
      props: {
        entries: mixedEntries,
        selectedPath: "",
        onselect: vi.fn(),
        ondelete,
      },
    });

    const button = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    const deleteBtn = screen.getByText("Delete");
    await fireEvent.click(deleteBtn);

    expect(ondelete).toHaveBeenCalledWith("/docs");
  });
});

describe("FileTree Copy Path context menu", () => {
  it("Copy Path appears in file context menu", async () => {
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        oncopypath: vi.fn(),
      },
    });

    const button = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    expect(screen.getByText("Copy Path")).toBeInTheDocument();
  });

  it("Copy Path appears in directory context menu", async () => {
    render(FileTree, {
      props: {
        entries: mixedEntries,
        selectedPath: "",
        onselect: vi.fn(),
        oncopypath: vi.fn(),
      },
    });

    const button = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    expect(screen.getByText("Copy Path")).toBeInTheDocument();
  });

  it("calls oncopypath with file path", async () => {
    const oncopypath = vi.fn();
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        oncopypath,
      },
    });

    const button = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    const copyBtn = screen.getByText("Copy Path");
    await fireEvent.click(copyBtn);

    expect(oncopypath).toHaveBeenCalledWith("/readme.md");
  });

  it("calls oncopypath with directory path", async () => {
    const oncopypath = vi.fn();
    render(FileTree, {
      props: {
        entries: mixedEntries,
        selectedPath: "",
        onselect: vi.fn(),
        oncopypath,
      },
    });

    const button = document.querySelector('button[data-path="/docs"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    const copyBtn = screen.getByText("Copy Path");
    await fireEvent.click(copyBtn);

    expect(oncopypath).toHaveBeenCalledWith("/docs");
  });

  it("menu closes after Copy Path clicked", async () => {
    const oncopypath = vi.fn();
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        oncopypath,
      },
    });

    const button = document.querySelector('button[data-path="/readme.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    expect(screen.getByText("Copy Path")).toBeInTheDocument();

    const copyBtn = screen.getByText("Copy Path");
    await fireEvent.click(copyBtn);

    // Menu should close after clicking
    expect(screen.queryByText("Copy Path")).not.toBeInTheDocument();
  });
});

describe("FileTree Delete key", () => {
  it("Delete key calls ondelete for focused directory", async () => {
    const ondelete = vi.fn();
    render(FileTree, {
      props: {
        entries: mixedEntries,
        selectedPath: "",
        onselect: vi.fn(),
        ondelete,
      },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus docs (directory)
    await fireEvent.keyDown(tree, { key: "Delete" });

    expect(ondelete).toHaveBeenCalledWith("/docs");
  });

  it("Delete key calls ondelete for focused file", async () => {
    const ondelete = vi.fn();
    render(FileTree, {
      props: {
        entries: fileEntries,
        selectedPath: "",
        onselect: vi.fn(),
        ondelete,
      },
    });

    const tree = screen.getByRole("tree");
    await fireEvent.keyDown(tree, { key: "ArrowDown" }); // focus readme.md
    await fireEvent.keyDown(tree, { key: "Delete" });

    expect(ondelete).toHaveBeenCalledWith("/readme.md");
  });
});

describe("FileTree root drop gaps", () => {
  it("renders gap elements between root-level items", () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), docsPath: "/root" },
    });

    const gaps = document.querySelectorAll(".root-drop-gap");
    // One gap before each item + one after the last = entries.length + 1
    expect(gaps.length).toBe(fileEntries.length + 1);
  });

  it("dropping on a gap calls onmovefile with docsPath as target", async () => {
    const nestedEntries: FileEntry[] = [
      {
        name: "sub",
        path: "/root/sub",
        is_directory: true,
        children: [
          { name: "nested.md", path: "/root/sub/nested.md", is_directory: false, children: [] },
        ],
      },
      { name: "readme.md", path: "/root/readme.md", is_directory: false, children: [] },
    ];
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: nestedEntries, selectedPath: "", onselect: vi.fn(), onmovefile, docsPath: "/root" },
    });

    const gaps = document.querySelectorAll(".root-drop-gap");
    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/root/sub/nested.md");
    await fireEvent.drop(gaps[0], { dataTransfer: dropTransfer });

    expect(onmovefile).toHaveBeenCalledWith("/root/sub/nested.md", "/root");
  });

  it("dropping a root-level item on a gap is a no-op", async () => {
    const onmovefile = vi.fn();
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), onmovefile, docsPath: "" },
    });

    const gaps = document.querySelectorAll(".root-drop-gap");
    const dropTransfer = new DataTransfer();
    dropTransfer.setData("text/plain", "/readme.md");
    await fireEvent.drop(gaps[0], { dataTransfer: dropTransfer });

    // Parent dir of /readme.md is "" which equals docsPath, so no-op
    expect(onmovefile).not.toHaveBeenCalled();
  });

  it("gap shows active class on dragOver", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), docsPath: "/root" },
    });

    const gaps = document.querySelectorAll(".root-drop-gap");
    await fireEvent.dragOver(gaps[0], { dataTransfer: { dropEffect: "" } });

    expect(gaps[0].classList.contains("active")).toBe(true);
  });

  it("gap removes active class on dragLeave", async () => {
    render(FileTree, {
      props: { entries: fileEntries, selectedPath: "", onselect: vi.fn(), docsPath: "/root" },
    });

    const gaps = document.querySelectorAll(".root-drop-gap");
    await fireEvent.dragOver(gaps[0], { dataTransfer: { dropEffect: "" } });
    expect(gaps[0].classList.contains("active")).toBe(true);

    await fireEvent.dragLeave(gaps[0]);
    expect(gaps[0].classList.contains("active")).toBe(false);
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
