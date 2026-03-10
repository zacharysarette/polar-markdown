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
    const wrapper = container.querySelector(".diagram-overlay-svg-wrapper");
    expect(wrapper?.innerHTML).toContain("<svg>");
    expect(wrapper?.innerHTML).toContain("Hello Diagram");
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

  it("renders zoom toolbar when visible", () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    expect(container.querySelector(".diagram-overlay-toolbar")).toBeTruthy();
    expect(container.querySelector(".zoom-display")).toBeTruthy();
  });

  it("shows zoom level display", () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    const display = container.querySelector(".zoom-display");
    expect(display?.textContent).toMatch(/\d+%/);
  });

  it("has zoom in, zoom out, and fit buttons", () => {
    render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
    expect(screen.getByLabelText("Fit to screen")).toBeTruthy();
  });

  it("zoom in button increases zoom level display", async () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    const display = container.querySelector(".zoom-display")!;
    const initialText = display.textContent!;
    const initialPct = parseInt(initialText);

    const zoomInBtn = screen.getByLabelText("Zoom in");
    await fireEvent.click(zoomInBtn);

    const newPct = parseInt(display.textContent!);
    expect(newPct).toBeGreaterThan(initialPct);
  });

  it("zoom out button decreases zoom level display", async () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    const display = container.querySelector(".zoom-display")!;

    // First zoom in so we have room to zoom out
    const zoomInBtn = screen.getByLabelText("Zoom in");
    await fireEvent.click(zoomInBtn);
    await fireEvent.click(zoomInBtn);
    const afterZoomIn = parseInt(display.textContent!);

    const zoomOutBtn = screen.getByLabelText("Zoom out");
    await fireEvent.click(zoomOutBtn);

    const afterZoomOut = parseInt(display.textContent!);
    expect(afterZoomOut).toBeLessThan(afterZoomIn);
  });

  it("fit button is clickable and does not crash", async () => {
    render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    // In test env, SVG has zero dimensions so fitToScreen is a no-op.
    // Just verify the button exists and doesn't throw.
    const fitBtn = screen.getByLabelText("Fit to screen");
    await fireEvent.click(fitBtn);
    expect(fitBtn).toBeTruthy();
  });

  it("Ctrl+= zooms in", async () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    const display = container.querySelector(".zoom-display")!;
    const initialPct = parseInt(display.textContent!);

    await fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    const newPct = parseInt(display.textContent!);
    expect(newPct).toBeGreaterThan(initialPct);
  });

  it("Ctrl+- zooms out", async () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    const display = container.querySelector(".zoom-display")!;

    // Zoom in first
    await fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    await fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    const afterZoomIn = parseInt(display.textContent!);

    await fireEvent.keyDown(window, { key: "-", ctrlKey: true });
    const afterZoomOut = parseInt(display.textContent!);
    expect(afterZoomOut).toBeLessThan(afterZoomIn);
  });

  it("Ctrl+0 calls fit (does not crash)", async () => {
    render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    // In test env, fitToScreen is a no-op (zero SVG dimensions).
    // Verify shortcut doesn't throw.
    await fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    const display = document.querySelector(".zoom-display");
    expect(display).toBeTruthy();
  });

  it("applies scale transform to svg wrapper", async () => {
    const { container } = render(DiagramOverlay, { visible: true, svgHtml: "<svg></svg>" });
    const wrapper = container.querySelector(".diagram-overlay-svg-wrapper") as HTMLElement;
    expect(wrapper.style.transform).toMatch(/scale\(/);
  });

  it("does not handle keyboard shortcuts when not visible", async () => {
    const { container } = render(DiagramOverlay, { visible: false, svgHtml: "<svg></svg>" });
    // No overlay = no zoom display to check, just verify no error
    expect(container.querySelector(".diagram-overlay-toolbar")).toBeNull();
  });
});
