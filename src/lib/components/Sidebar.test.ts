import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import Sidebar from "./Sidebar.svelte";

describe("Sidebar", () => {
  it("renders the sidebar header with action buttons", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onnewfile: vi.fn() },
    });

    expect(screen.getByTitle("New file")).toBeInTheDocument();
  });

  it("renders with file browser aria label", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByLabelText("File browser")).toBeInTheDocument();
  });

  it("shows empty message when no entries", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByText("No markdown files found.")).toBeInTheDocument();
  });

  it("renders file entries", () => {
    const entries = [
      { name: "test.md", path: "/docs/test.md", is_directory: false, children: [] },
    ];

    render(Sidebar, {
      props: { entries, selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByText("test.md")).toBeInTheDocument();
  });

  it("focuses the file tree when sidebar content area is clicked", async () => {
    const entries = [
      { name: "test.md", path: "/docs/test.md", is_directory: false, children: [] },
    ];

    render(Sidebar, {
      props: { entries, selectedPath: "", onselect: vi.fn() },
    });

    const nav = screen.getByRole("navigation");
    await fireEvent.click(nav);

    // The file tree inside the sidebar should have received focus
    const tree = screen.getByRole("tree");
    expect(tree).toHaveFocus();
  });

  it("renders a change folder button", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onchangefolder: vi.fn() },
    });

    expect(screen.getByTitle("Change folder")).toBeInTheDocument();
  });

  it("calls onchangefolder callback when change folder button is clicked", async () => {
    const onchangefolder = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onchangefolder },
    });

    const button = screen.getByTitle("Change folder");
    await fireEvent.click(button);

    expect(onchangefolder).toHaveBeenCalledOnce();
  });

  it("renders a sort control", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), sortMode: "name-asc", onsortchange: vi.fn() },
    });

    expect(screen.getByTitle("Sort files")).toBeInTheDocument();
  });

  it("calls onsortchange callback when sort button is clicked", async () => {
    const onsortchange = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), sortMode: "name-asc", onsortchange },
    });

    const button = screen.getByTitle("Sort files");
    await fireEvent.click(button);

    expect(onsortchange).toHaveBeenCalledOnce();
  });

  it("renders a help button", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onhelp: vi.fn() },
    });

    expect(screen.getByTitle("Help")).toBeInTheDocument();
  });

  it("calls onhelp callback when help button is clicked", async () => {
    const onhelp = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onhelp },
    });

    const button = screen.getByTitle("Help");
    await fireEvent.click(button);

    expect(onhelp).toHaveBeenCalledOnce();
  });

  it("renders search toggle button", () => {
    render(Sidebar, {
      props: {
        entries: [],
        selectedPath: "",
        onselect: vi.fn(),
        onfilterchange: vi.fn(),
        onsearchmodechange: vi.fn(),
        onsearchchange: vi.fn(),
      },
    });

    expect(screen.getByTitle("Search file contents")).toBeInTheDocument();
  });

  it("calls onsearchmodechange when search toggle is clicked", async () => {
    const onsearchmodechange = vi.fn();
    render(Sidebar, {
      props: {
        entries: [],
        selectedPath: "",
        onselect: vi.fn(),
        onfilterchange: vi.fn(),
        onsearchmodechange,
        onsearchchange: vi.fn(),
      },
    });

    const button = screen.getByTitle("Search file contents");
    await fireEvent.click(button);

    expect(onsearchmodechange).toHaveBeenCalledOnce();
  });

  it("highlights help button when helpActive is true", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onhelp: vi.fn(), helpActive: true },
    });

    const helpBtn = screen.getByTitle("Help");
    expect(helpBtn.classList.contains("help-active")).toBe(true);
  });

  it("does not highlight help button when helpActive is false", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onhelp: vi.fn(), helpActive: false },
    });

    const helpBtn = screen.getByTitle("Help");
    expect(helpBtn.classList.contains("help-active")).toBe(false);
  });

  // New file creation tests
  it("renders + button when onnewfile is provided", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onnewfile: vi.fn() },
    });

    expect(screen.getByTitle("New file")).toBeInTheDocument();
  });

  it("does not render + button without onnewfile prop", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.queryByTitle("New file")).not.toBeInTheDocument();
  });

  it("calls onnewfile when + button is clicked", async () => {
    const onnewfile = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), onnewfile },
    });

    await fireEvent.click(screen.getByTitle("New file"));
    expect(onnewfile).toHaveBeenCalledOnce();
  });

  it("shows input when creatingFile is true", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: true },
    });

    expect(screen.getByTestId("new-file-input")).toBeInTheDocument();
  });

  it("hides input when creatingFile is false", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: false },
    });

    expect(screen.queryByTestId("new-file-input")).not.toBeInTheDocument();
  });

  it("calls oncreatenewfile on Enter in input", async () => {
    const oncreatenewfile = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: true, oncreatenewfile },
    });

    const input = screen.getByTestId("new-file-input");
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(oncreatenewfile).toHaveBeenCalledWith("untitled.md");
  });

  it("calls oncancelcreate on Escape in input", async () => {
    const oncancelcreate = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: true, oncancelcreate },
    });

    const input = screen.getByTestId("new-file-input");
    await fireEvent.keyDown(input, { key: "Escape" });

    expect(oncancelcreate).toHaveBeenCalledOnce();
  });

  it("shows error message when newFileError is set", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: true, newFileError: "File already exists" },
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("File already exists");
  });

  it("hides error message when newFileError is empty", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: true, newFileError: "" },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders confirm button when creatingFile is true", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: true },
    });

    expect(screen.getByTitle("Create file")).toBeInTheDocument();
  });

  it("calls oncreatenewfile when confirm button is clicked", async () => {
    const oncreatenewfile = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), creatingFile: true, oncreatenewfile },
    });

    const button = screen.getByTitle("Create file");
    await fireEvent.click(button);

    expect(oncreatenewfile).toHaveBeenCalledWith("untitled.md");
  });

  it("passes renamingPath through to FileTree", () => {
    const entries = [
      { name: "test.md", path: "/docs/test.md", is_directory: false, children: [] },
    ];

    render(Sidebar, {
      props: {
        entries,
        selectedPath: "",
        onselect: vi.fn(),
        renamingPath: "/docs/test.md",
      },
    });

    // The rename input should appear because renamingPath matches the file
    expect(screen.getByTestId("rename-input")).toBeInTheDocument();
  });

  it("displays folder name when docsPath is provided", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), docsPath: "C:\\Users\\Zach\\docs\\my-project" },
    });

    expect(screen.getByText("my-project")).toBeInTheDocument();
  });

  it("shows full path in folder-path title tooltip", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), docsPath: "C:\\Users\\Zach\\docs\\my-project" },
    });

    const folderPath = screen.getByText("my-project");
    expect(folderPath.getAttribute("title")).toBe("C:\\Users\\Zach\\docs\\my-project");
  });

  it("does not display folder path when docsPath is empty", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), docsPath: "" },
    });

    expect(screen.queryByText("my-project")).not.toBeInTheDocument();
  });

  it("passes onsaveas through to FileTree", async () => {
    const entries = [
      { name: "test.md", path: "/docs/test.md", is_directory: false, children: [] },
    ];
    const onsaveas = vi.fn();

    render(Sidebar, {
      props: { entries, selectedPath: "", onselect: vi.fn(), onsaveas },
    });

    // Right-click the file to trigger context menu
    const button = document.querySelector('button[data-path="/docs/test.md"]') as HTMLElement;
    await fireEvent.contextMenu(button);

    const saveAsBtn = screen.getByText("Save As");
    await fireEvent.click(saveAsBtn);

    expect(onsaveas).toHaveBeenCalledWith("/docs/test.md");
  });

  it("renders theme toggle button when onthemetoggle is provided", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), theme: "aurora", onthemetoggle: vi.fn() },
    });

    const btn = screen.getByTitle("Switch to Glacier (light)");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent?.trim()).toContain("☀️");
  });

  it("shows moon emoji when theme is glacier", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), theme: "glacier", onthemetoggle: vi.fn() },
    });

    const btn = screen.getByTitle("Switch to Aurora (dark)");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent?.trim()).toContain("🌙");
  });

  it("calls onthemetoggle when theme button is clicked", async () => {
    const onthemetoggle = vi.fn();
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), theme: "aurora", onthemetoggle },
    });

    const btn = screen.getByTitle("Switch to Glacier (light)");
    await fireEvent.click(btn);

    expect(onthemetoggle).toHaveBeenCalledOnce();
  });

  it("shows skeleton bars when loading is true and entries are empty", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), loading: true },
    });

    const skeletonBars = document.querySelectorAll(".skeleton-bar");
    expect(skeletonBars.length).toBeGreaterThan(0);
    expect(skeletonBars.length).toBe(7);
  });

  it("does not show skeleton bars when loading is false", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn(), loading: false },
    });

    const skeletonBars = document.querySelectorAll(".skeleton-bar");
    expect(skeletonBars.length).toBe(0);
  });

  it("shows search results instead of file tree when searchMode is active with a query", () => {
    const searchResults = [
      { path: "/docs/readme.md", name: "readme.md", matches: [{ line_number: 1, line_content: "# README" }] },
    ];

    render(Sidebar, {
      props: {
        entries: [{ name: "other.md", path: "/docs/other.md", is_directory: false, children: [] }],
        selectedPath: "",
        onselect: vi.fn(),
        searchMode: true,
        searchQuery: "readme",
        searchResults,
        onsearchchange: vi.fn(),
        onsearchmodechange: vi.fn(),
      },
    });

    // Should show search result, not the file tree entry
    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.queryByText("other.md")).not.toBeInTheDocument();
  });
});
