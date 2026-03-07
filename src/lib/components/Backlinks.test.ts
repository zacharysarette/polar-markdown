import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import Backlinks from "./Backlinks.svelte";
import type { SearchResult } from "../types";

const mockBacklinks: SearchResult[] = [
  {
    path: "/docs/index.md",
    name: "index.md",
    matches: [{ line_number: 3, line_content: "See [[notes]] for details." }],
  },
  {
    path: "/docs/guide.md",
    name: "guide.md",
    matches: [
      { line_number: 5, line_content: "Refer to [[notes|my notes]]." },
      { line_number: 10, line_content: "Also see [[notes]]." },
    ],
  },
];

describe("Backlinks", () => {
  it("renders nothing when backlinks is empty", () => {
    const { container } = render(Backlinks, { backlinks: [] });
    expect(container.querySelector(".backlinks")).toBeNull();
  });

  it("shows backlink count in collapsed state", () => {
    render(Backlinks, { backlinks: mockBacklinks });
    expect(screen.getByText("2 backlinks")).toBeTruthy();
  });

  it("expands to show file links on click", async () => {
    render(Backlinks, { backlinks: mockBacklinks });
    await fireEvent.click(screen.getByText("2 backlinks"));
    expect(screen.getByText("index.md")).toBeTruthy();
    expect(screen.getByText("guide.md")).toBeTruthy();
  });

  it("calls onselect when a file link is clicked", async () => {
    const onselect = vi.fn();
    render(Backlinks, { backlinks: mockBacklinks, onselect });
    await fireEvent.click(screen.getByText("2 backlinks"));
    await fireEvent.click(screen.getByText("index.md"));
    expect(onselect).toHaveBeenCalledWith("/docs/index.md");
  });

  it("shows singular 'backlink' for count of 1", () => {
    render(Backlinks, { backlinks: [mockBacklinks[0]] });
    expect(screen.getByText("1 backlink")).toBeTruthy();
  });
});
