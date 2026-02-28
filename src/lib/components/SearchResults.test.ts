import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import SearchResults from "./SearchResults.svelte";
import type { SearchResult } from "../types";

describe("SearchResults", () => {
  const mockResults: SearchResult[] = [
    {
      path: "/docs/readme.md",
      name: "readme.md",
      matches: [
        { line_number: 1, line_content: "# README" },
        { line_number: 5, line_content: "See the readme for details." },
      ],
    },
    {
      path: "/docs/plan.md",
      name: "plan.md",
      matches: [{ line_number: 3, line_content: "## Plan Overview" }],
    },
  ];

  it("renders file names from search results", () => {
    render(SearchResults, {
      props: { results: mockResults, query: "readme", onselect: vi.fn() },
    });

    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByText("plan.md")).toBeInTheDocument();
  });

  it("renders matching line content", () => {
    render(SearchResults, {
      props: { results: mockResults, query: "readme", onselect: vi.fn() },
    });

    expect(screen.getByText(/# README/)).toBeInTheDocument();
    expect(screen.getByText(/Plan Overview/)).toBeInTheDocument();
  });

  it("renders line numbers", () => {
    render(SearchResults, {
      props: { results: mockResults, query: "readme", onselect: vi.fn() },
    });

    expect(screen.getByText("1:")).toBeInTheDocument();
    expect(screen.getByText("5:")).toBeInTheDocument();
    expect(screen.getByText("3:")).toBeInTheDocument();
  });

  it("calls onselect with path only when a file name is clicked", async () => {
    const onselect = vi.fn();
    render(SearchResults, {
      props: { results: mockResults, query: "readme", onselect },
    });

    const fileButton = screen.getByText("readme.md");
    await fireEvent.click(fileButton);

    expect(onselect).toHaveBeenCalledWith("/docs/readme.md", undefined);
  });

  it("calls onselect with path and line content when a result line is clicked", async () => {
    const onselect = vi.fn();
    render(SearchResults, {
      props: { results: mockResults, query: "readme", onselect },
    });

    const lineButton = screen.getByText(/See the readme for details/).closest("button");
    await fireEvent.click(lineButton!);

    expect(onselect).toHaveBeenCalledWith("/docs/readme.md", "See the readme for details.");
  });

  it("shows match count per file", () => {
    render(SearchResults, {
      props: { results: mockResults, query: "readme", onselect: vi.fn() },
    });

    expect(screen.getByText("2 matches")).toBeInTheDocument();
    expect(screen.getByText("1 match")).toBeInTheDocument();
  });

  it("shows empty message when no results", () => {
    render(SearchResults, {
      props: { results: [], query: "nothing", onselect: vi.fn() },
    });

    expect(screen.getByText(/No results/)).toBeInTheDocument();
  });
});
