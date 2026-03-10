import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import DiagramOverlay from "./DiagramOverlay.svelte";

describe("DiagramOverlay", () => {
  it("renders nothing when visible is false", () => {
    const { container } = render(DiagramOverlay, { visible: false, svgHtml: "<svg></svg>" });
    expect(container.querySelector(".diagram-overlay")).toBeNull();
  });

  it("renders overlay when visible is true", () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg><text>Test</text></svg>" });
    expect(container.querySelector(".diagram-overlay")).toBeTruthy();
    expect(container.querySelector(".diagram-overlay-content")).toBeTruthy();
  });

  it("renders SVG content inside overlay", () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg><text>Hello Diagram</text></svg>" });
    const content = container.querySelector(".diagram-overlay-content");
    expect(content?.innerHTML).toContain("<svg>");
    expect(content?.innerHTML).toContain("Hello Diagram");
  });

  it("calls onclose when close button is clicked", async () => {
    const onclose = vi.fn();
    render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>", onclose });
    const closeBtn = screen.getByLabelText("Close diagram overlay");
    await fireEvent.click(closeBtn);
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("calls onclose when backdrop is clicked", async () => {
    const onclose = vi.fn();
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>", onclose });
    const backdrop = container.querySelector(".diagram-overlay")!;
    await fireEvent.click(backdrop);
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("does not call onclose when content area is clicked", async () => {
    const onclose = vi.fn();
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>", onclose });
    const content = container.querySelector(".diagram-overlay-content")!;
    await fireEvent.click(content);
    expect(onclose).not.toHaveBeenCalled();
  });

  it("calls onclose on Escape key", async () => {
    const onclose = vi.fn();
    render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>", onclose });
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("does not call onclose on Escape when not visible", async () => {
    const onclose = vi.fn();
    render(DiagramOverlay, { visible: false, svgHtml: "<svg></svg>", onclose });
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onclose).not.toHaveBeenCalled();
  });
});
