import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import DocStats from "./DocStats.svelte";
import type { DocumentStats } from "../services/doc-stats";

const mockStats: DocumentStats = {
  words: 150,
  characters: 800,
  charactersNoSpaces: 650,
  lines: 20,
  sentences: 10,
  paragraphs: 5,
  readingTimeMinutes: 1,
  fleschReadingEase: 65.3,
  fleschKincaidGrade: 8.2,
};

describe("DocStats", () => {
  it("renders nothing when visible is false", () => {
    const { container } = render(DocStats, { stats: mockStats, visible: false });
    expect(container.querySelector(".doc-stats")).toBeNull();
  });

  it("renders nothing when stats is null", () => {
    const { container } = render(DocStats, { stats: null, visible: true });
    expect(container.querySelector(".doc-stats")).toBeNull();
  });

  it("renders nothing when words is 0", () => {
    const { container } = render(DocStats, { stats: { ...mockStats, words: 0 }, visible: true });
    expect(container.querySelector(".doc-stats")).toBeNull();
  });

  it("renders all stats when visible with data", () => {
    render(DocStats, { stats: mockStats, visible: true });
    expect(screen.getByText("150 words")).toBeTruthy();
    expect(screen.getByText("800 chars")).toBeTruthy();
    expect(screen.getByText("20 lines")).toBeTruthy();
    expect(screen.getByText("10 sentences")).toBeTruthy();
    expect(screen.getByText("5 paragraphs")).toBeTruthy();
    expect(screen.getByText("1 min read")).toBeTruthy();
  });

  it("formats Flesch scores with one decimal", () => {
    render(DocStats, { stats: mockStats, visible: true });
    expect(screen.getByText("FRE 65.3")).toBeTruthy();
    expect(screen.getByText("FK 8.2")).toBeTruthy();
  });
});
