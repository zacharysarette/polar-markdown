import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import TableOfContents from "./TableOfContents.svelte";
import type { TocEntry } from "../types";

describe("TableOfContents", () => {
  const sampleEntries: TocEntry[] = [
    { text: "Introduction", slug: "introduction", depth: 1 },
    { text: "Getting Started", slug: "getting-started", depth: 2 },
    { text: "Installation", slug: "installation", depth: 3 },
    { text: "API Reference", slug: "api-reference", depth: 2 },
  ];

  it("renders nothing when entries are empty", () => {
    const { container } = render(TableOfContents, {
      props: { entries: [], activeSlug: "", onselect: vi.fn() },
    });
    expect(container.querySelector("ul")).toBeNull();
  });

  it("renders list of heading entries", () => {
    render(TableOfContents, {
      props: { entries: sampleEntries, activeSlug: "", onselect: vi.fn() },
    });
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Installation")).toBeInTheDocument();
    expect(screen.getByText("API Reference")).toBeInTheDocument();
  });

  it("applies correct indentation per depth level", () => {
    render(TableOfContents, {
      props: { entries: sampleEntries, activeSlug: "", onselect: vi.fn() },
    });
    const items = screen.getAllByRole("button");
    // depth 1 = 0px, depth 2 = 12px, depth 3 = 24px
    expect(items[0].style.paddingLeft).toBe("0px");
    expect(items[1].style.paddingLeft).toBe("12px");
    expect(items[2].style.paddingLeft).toBe("24px");
    expect(items[3].style.paddingLeft).toBe("12px");
  });

  it("calls onselect with slug on click", async () => {
    const onselect = vi.fn();
    render(TableOfContents, {
      props: { entries: sampleEntries, activeSlug: "", onselect },
    });
    await fireEvent.click(screen.getByText("API Reference"));
    expect(onselect).toHaveBeenCalledWith("api-reference");
  });

  it("highlights entry matching activeSlug", () => {
    render(TableOfContents, {
      props: { entries: sampleEntries, activeSlug: "getting-started", onselect: vi.fn() },
    });
    const activeBtn = screen.getByText("Getting Started");
    expect(activeBtn.classList.contains("active")).toBe(true);
  });

  it("does not highlight non-active entries", () => {
    render(TableOfContents, {
      props: { entries: sampleEntries, activeSlug: "introduction", onselect: vi.fn() },
    });
    const otherBtn = screen.getByText("Getting Started");
    expect(otherBtn.classList.contains("active")).toBe(false);
  });
});
