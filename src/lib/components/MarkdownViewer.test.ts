import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";

// Mock mermaid
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

import MarkdownViewer from "./MarkdownViewer.svelte";

describe("MarkdownViewer", () => {
  it("shows empty state when no content", () => {
    render(MarkdownViewer, {
      props: { content: "", filePath: "" },
    });

    expect(screen.getByText("Planning Central")).toBeInTheDocument();
    expect(
      screen.getByText("Select a markdown file from the sidebar to view it.")
    ).toBeInTheDocument();
  });

  it("has the markdown viewer aria label", () => {
    render(MarkdownViewer, {
      props: { content: "", filePath: "" },
    });

    expect(screen.getByLabelText("Markdown viewer")).toBeInTheDocument();
  });

  it("shows file name in header when content is provided", async () => {
    render(MarkdownViewer, {
      props: { content: "# Hello", filePath: "/docs/test.md" },
    });

    // Wait for async markdown rendering
    await vi.waitFor(() => {
      expect(screen.getByText("test.md")).toBeInTheDocument();
    });
  });
});
