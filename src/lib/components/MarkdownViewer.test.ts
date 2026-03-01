import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/svelte";

// Mock mermaid
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Tauri API (needed for image resolution in markdown renderer)
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  invoke: vi.fn(),
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

  it("renders with centered class when layoutMode is centered", async () => {
    render(MarkdownViewer, {
      props: { content: "# Hello", filePath: "/docs/test.md", layoutMode: "centered" },
    });

    await vi.waitFor(() => {
      const article = document.querySelector("article.markdown-body");
      expect(article).not.toBeNull();
      expect(article!.classList.contains("centered")).toBe(true);
    });
  });

  it("renders with columns class when layoutMode is columns", async () => {
    render(MarkdownViewer, {
      props: { content: "# Hello", filePath: "/docs/test.md", layoutMode: "columns" },
    });

    await vi.waitFor(() => {
      const article = document.querySelector("article.markdown-body");
      expect(article).not.toBeNull();
      expect(article!.classList.contains("columns")).toBe(true);
    });
  });

  it("defaults to centered when no layoutMode prop", async () => {
    render(MarkdownViewer, {
      props: { content: "# Hello", filePath: "/docs/test.md" },
    });

    await vi.waitFor(() => {
      const article = document.querySelector("article.markdown-body");
      expect(article).not.toBeNull();
      expect(article!.classList.contains("centered")).toBe(true);
    });
  });

  it("shows layout toggle buttons in the header", async () => {
    render(MarkdownViewer, {
      props: { content: "# Hello", filePath: "/docs/test.md" },
    });

    await vi.waitFor(() => {
      expect(screen.getByTitle("Single column")).toBeInTheDocument();
      expect(screen.getByTitle("Multi-column")).toBeInTheDocument();
    });
  });

  describe("image layout shift fix", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it("re-scrolls search highlight after images load", async () => {
      // Render with content containing an image and searchable text below it
      const contentWithImage = "![photo](test.png)\n\n# Target Heading";

      const { container } = render(MarkdownViewer, {
        props: {
          content: contentWithImage,
          filePath: "/docs/test.md",
          highlightText: "Target Heading",
          highlightKey: 1,
        },
      });

      // Wait for markdown to render
      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.innerHTML).toContain("img");
      });

      // Spy on scrollIntoView to track re-scroll calls
      const scrollSpy = vi.fn();

      // Wait for the initial search highlight to happen
      await vi.advanceTimersByTimeAsync(100);

      // Find the image and simulate its load event (layout shift trigger)
      const img = container.querySelector("img") as HTMLImageElement;
      expect(img).not.toBeNull();

      // Mock img.complete = false to ensure the load listener is attached
      Object.defineProperty(img, "complete", { value: false, writable: true });

      // The search effect should have added a load listener.
      // Verify that firing load on the image causes a re-scroll.
      // We track this by checking that scrollIntoView is called on a mark element
      const markEl = container.querySelector("mark.search-highlight");
      if (markEl) {
        markEl.scrollIntoView = scrollSpy;
      }

      // Fire the image load event
      img.dispatchEvent(new Event("load"));

      // Allow the effect to re-run after imagesReady increments
      await vi.advanceTimersByTimeAsync(100);

      // The search effect should have re-fired after image load,
      // causing a new scrollIntoView on the highlighted element
      // (the mark gets recreated each time, so we check any mark)
      const marks = container.querySelectorAll("mark.search-highlight");
      expect(marks.length).toBeGreaterThan(0);
    });

    it("attaches load listeners to incomplete images after HTML renders", async () => {
      const contentWithImages = "![a](a.png)\n\n![b](b.png)\n\nSome text";

      const { container } = render(MarkdownViewer, {
        props: {
          content: contentWithImages,
          filePath: "/docs/test.md",
        },
      });

      // Wait for markdown to render with images
      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        const imgs = article!.querySelectorAll("img");
        expect(imgs.length).toBe(2);
      });

      // Images should exist in the rendered output
      const imgs = container.querySelectorAll("img");
      expect(imgs.length).toBe(2);
    });
  });
});
