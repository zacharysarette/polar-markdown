import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import Sidebar from "./Sidebar.svelte";

describe("Sidebar", () => {
  it("renders the Files header", () => {
    render(Sidebar, {
      props: { entries: [], selectedPath: "", onselect: vi.fn() },
    });

    expect(screen.getByText("Files")).toBeInTheDocument();
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
});
