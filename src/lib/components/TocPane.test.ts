import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import TocPane from "./TocPane.svelte";
import type { TocEntry } from "../types";

describe("TocPane", () => {
  const sampleEntries: TocEntry[] = [
    { text: "Introduction", slug: "introduction", depth: 1 },
    { text: "Getting Started", slug: "getting-started", depth: 2 },
  ];

  it("renders file name in header", () => {
    render(TocPane, {
      props: { entries: sampleEntries, activeSlug: "", onselect: vi.fn(), onclose: vi.fn(), fileName: "readme.md" },
    });
    expect(screen.getByText("TOC: readme.md")).toBeInTheDocument();
  });

  it("renders TableOfContents with entries", () => {
    render(TocPane, {
      props: { entries: sampleEntries, activeSlug: "", onselect: vi.fn(), onclose: vi.fn() },
    });
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
  });

  it("close button calls onclose", async () => {
    const onclose = vi.fn();
    render(TocPane, {
      props: { entries: sampleEntries, activeSlug: "", onselect: vi.fn(), onclose },
    });
    await fireEvent.click(screen.getByTitle("Close TOC (Ctrl+T)"));
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("passes activeSlug through to TableOfContents", () => {
    render(TocPane, {
      props: { entries: sampleEntries, activeSlug: "getting-started", onselect: vi.fn(), onclose: vi.fn() },
    });
    const activeBtn = screen.getByText("Getting Started");
    expect(activeBtn.classList.contains("active")).toBe(true);
  });

  it("click entry calls onselect with slug", async () => {
    const onselect = vi.fn();
    render(TocPane, {
      props: { entries: sampleEntries, activeSlug: "", onselect, onclose: vi.fn() },
    });
    await fireEvent.click(screen.getByText("Introduction"));
    expect(onselect).toHaveBeenCalledWith("introduction");
  });

  it("shows empty state when no entries", () => {
    render(TocPane, {
      props: { entries: [], activeSlug: "", onselect: vi.fn(), onclose: vi.fn() },
    });
    expect(screen.getByText("No headings found.")).toBeInTheDocument();
  });
});
