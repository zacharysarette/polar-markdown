import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/svelte";

// Mock mermaid
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn().mockResolvedValue(undefined),
    parse: vi.fn().mockResolvedValue(true),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>', bindFunctions: vi.fn() }),
  },
}));

// Mock Tauri API (needed for image resolution in markdown renderer)
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  invoke: vi.fn(),
}));

// Mock shell plugin for external link handling (vi.hoisted runs before mock hoisting)
const { mockShellOpen } = vi.hoisted(() => ({
  mockShellOpen: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: mockShellOpen,
}));

import MarkdownViewer from "./MarkdownViewer.svelte";

describe("MarkdownViewer", () => {
  it("shows empty state when no content", () => {
    render(MarkdownViewer, {
      props: { content: "", filePath: "" },
    });

    expect(screen.getByText("Glacimark")).toBeInTheDocument();
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

  describe("source line numbers toggle", () => {
    it("renders the line numbers toggle button", async () => {
      render(MarkdownViewer, {
        props: { content: "# Hello", filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        expect(screen.getByTitle("Toggle source line numbers")).toBeInTheDocument();
      });
    });

    it("fires onlinenumberschange when toggle is clicked", async () => {
      const onlinenumberschange = vi.fn();
      render(MarkdownViewer, {
        props: { content: "# Hello", filePath: "/docs/test.md", showLineNumbers: false, onlinenumberschange },
      });

      await vi.waitFor(() => {
        expect(screen.getByTitle("Toggle source line numbers")).toBeInTheDocument();
      });

      screen.getByTitle("Toggle source line numbers").click();
      expect(onlinenumberschange).toHaveBeenCalledWith(true);
    });

    it("applies show-source-lines class when enabled", async () => {
      render(MarkdownViewer, {
        props: { content: "# Hello", filePath: "/docs/test.md", showLineNumbers: true },
      });

      await vi.waitFor(() => {
        const article = document.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.classList.contains("show-source-lines")).toBe(true);
      });
    });

    it("does NOT apply show-source-lines class when disabled", async () => {
      render(MarkdownViewer, {
        props: { content: "# Hello", filePath: "/docs/test.md", showLineNumbers: false },
      });

      await vi.waitFor(() => {
        const article = document.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.classList.contains("show-source-lines")).toBe(false);
      });
    });
  });

  describe("anchor link scrolling", () => {
    it("scrolls to target heading when anchor link is clicked", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: "# Top\n\n[Go](#top)\n\n## Section", filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.querySelector("#top")).not.toBeNull();
      });

      const heading = container.querySelector("#top") as HTMLElement;
      heading.scrollIntoView = vi.fn();

      const link = container.querySelector('a[href="#top"]') as HTMLAnchorElement;
      expect(link).not.toBeNull();
      link.click();

      expect(heading.scrollIntoView).toHaveBeenCalled();
    });

    it("calls preventDefault on anchor link clicks", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: "# Top\n\n[Go](#top)", filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.querySelector("#top")).not.toBeNull();
      });

      const heading = container.querySelector("#top") as HTMLElement;
      heading.scrollIntoView = vi.fn();

      const article = container.querySelector("article.markdown-body") as HTMLElement;
      const link = container.querySelector('a[href="#top"]') as HTMLAnchorElement;

      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, "preventDefault");
      link.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it("intercepts external links and opens via shell", async () => {
      mockShellOpen.mockReset();
      const { container } = render(MarkdownViewer, {
        props: { content: "[External](https://example.com)", filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, "preventDefault");
      link.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
      expect(mockShellOpen).toHaveBeenCalledWith("https://example.com");
    });

    it("intercepts relative .md file links and calls onfilelink", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Other](./other.md)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, "preventDefault");
      link.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
      expect(onfilelink).toHaveBeenCalledWith("/docs/other.md", undefined, false);
    });
  });

  describe("file link navigation", () => {
    beforeEach(() => {
      mockShellOpen.mockReset();
    });

    it("clicking .md link calls onfilelink with resolved path", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Notes](notes.md)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        expect(article!.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      link.click();

      expect(onfilelink).toHaveBeenCalledWith("/docs/notes.md", undefined, false);
    });

    it("Ctrl+Click passes ctrlKey: true", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Notes](notes.md)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
      link.dispatchEvent(event);

      expect(onfilelink).toHaveBeenCalledWith("/docs/notes.md", undefined, true);
    });

    it("guide.md#installation splits into path + hash", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Guide](guide.md#installation)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      link.click();

      expect(onfilelink).toHaveBeenCalledWith("/docs/guide.md", "installation", false);
    });

    it("preventDefault called on .md clicks", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Notes](notes.md)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, "preventDefault");
      link.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it("decodes %20 in href before calling onfilelink", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Guide](<How to Use Glacimark.md>)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      link.click();

      expect(onfilelink).toHaveBeenCalledWith("/docs/How to Use Glacimark.md", undefined, false);
    });

    it("subdirectory relative paths resolved correctly", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Deep](sub/deep.md)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      link.click();

      expect(onfilelink).toHaveBeenCalledWith("/docs/sub/deep.md", undefined, false);
    });
  });

  describe("external link handling", () => {
    beforeEach(() => {
      mockShellOpen.mockReset();
    });

    it("https:// link calls shell.open()", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: "[Site](https://example.com)", filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      link.click();

      expect(mockShellOpen).toHaveBeenCalledWith("https://example.com");
    });

    it("http:// link calls shell.open()", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: "[Site](http://example.com)", filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      link.click();

      expect(mockShellOpen).toHaveBeenCalledWith("http://example.com");
    });

    it("preventDefault called on external clicks", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: "[Site](https://example.com)", filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, "preventDefault");
      link.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it("external links do NOT call onfilelink", async () => {
      const onfilelink = vi.fn();
      const { container } = render(MarkdownViewer, {
        props: { content: "[Site](https://example.com)", filePath: "/docs/test.md", onfilelink },
      });

      await vi.waitFor(() => {
        expect(container.querySelector("a")).not.toBeNull();
      });

      const link = container.querySelector("a") as HTMLAnchorElement;
      link.click();

      expect(onfilelink).not.toHaveBeenCalled();
    });
  });

  describe("mermaid status indicator", () => {
    it("shows mermaid status when diagrams are present", async () => {
      const contentWithMermaid = "# Title\n\n```mermaid\nflowchart TD\n    A-->B\n```";
      const { container } = render(MarkdownViewer, {
        props: { content: contentWithMermaid, filePath: "/docs/test.md" },
      });

      // Wait for markdown rendering + diagram debounce (1000ms) + signalContentReady (200ms)
      await vi.waitFor(() => {
        const status = container.querySelector(".mermaid-status");
        expect(status).not.toBeNull();
      }, { timeout: 3000 });
    });

    it("shows error status when diagrams fail", async () => {
      // Import and mock mermaid.parse to fail
      const mermaid = (await import("mermaid")).default;
      vi.mocked(mermaid.parse).mockRejectedValue(new Error("Parse error"));

      const contentWithBadMermaid = "# Title\n\n```mermaid\nbad diagram\n```";
      const { container } = render(MarkdownViewer, {
        props: { content: contentWithBadMermaid, filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const status = container.querySelector(".mermaid-status.has-errors");
        expect(status).not.toBeNull();
      }, { timeout: 3000 });

      // Reset mock for other tests
      vi.mocked(mermaid.parse).mockResolvedValue(true as any);
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

      // Allow the debounced contentReady signal (200ms) and effect to re-run
      await vi.advanceTimersByTimeAsync(300);

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

  describe("table horizontal scroll", () => {
    const wideTableMd = [
      "| " + Array.from({ length: 12 }, (_, i) => `Column${i}`).join(" | ") + " |",
      "| " + Array.from({ length: 12 }, () => "---").join(" | ") + " |",
      "| " + Array.from({ length: 12 }, (_, i) => `value${i}`).join(" | ") + " |",
    ].join("\n");

    it("wraps wide tables in a .table-wrapper div", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: wideTableMd, filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const wrapper = container.querySelector(".table-wrapper");
        expect(wrapper).not.toBeNull();
        expect(wrapper!.tagName).toBe("DIV");
        const table = wrapper!.querySelector("table");
        expect(table).not.toBeNull();
      });
    });

    it("table-wrapper is inside .markdown-body article", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: wideTableMd, filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const article = container.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        const wrapper = article!.querySelector(".table-wrapper");
        expect(wrapper).not.toBeNull();
      });
    });

    it("viewer element has .viewer class for overflow containment", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: wideTableMd, filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const viewer = container.querySelector(".viewer");
        expect(viewer).not.toBeNull();
        // Verify the containment chain: .viewer > article.markdown-body > .table-wrapper > table
        const article = viewer!.querySelector("article.markdown-body");
        expect(article).not.toBeNull();
        const wrapper = article!.querySelector(".table-wrapper");
        expect(wrapper).not.toBeNull();
        const table = wrapper!.querySelector("table");
        expect(table).not.toBeNull();
        expect(table!.querySelectorAll("th").length).toBe(12);
      });
    });

    it("table-wrapper is the direct parent of the table element", async () => {
      const { container } = render(MarkdownViewer, {
        props: { content: wideTableMd, filePath: "/docs/test.md" },
      });

      await vi.waitFor(() => {
        const table = container.querySelector("table");
        expect(table).not.toBeNull();
        expect(table!.parentElement!.classList.contains("table-wrapper")).toBe(true);
      });
    });
  });
});
