import { describe, it, expect } from "vitest";
import { extractDiagramLabels, getCodeBlockLineOverlayPosition } from "./highlight";

describe("extractDiagramLabels", () => {
  it("extracts text from square brackets", () => {
    const labels = extractDiagramLabels("C --> E[View in App]");
    expect(labels).toContain("View in App");
  });

  it("extracts text from parentheses", () => {
    const labels = extractDiagramLabels("A(Start Planning)");
    expect(labels).toContain("Start Planning");
  });

  it("extracts text from curly braces (decision nodes)", () => {
    const labels = extractDiagramLabels("B{Choose Approach}");
    expect(labels).toContain("Choose Approach");
  });

  it("extracts text after colon (sequence diagram messages)", () => {
    const labels = extractDiagramLabels("User->>Claude: Describe what you need");
    expect(labels).toContain("Describe what you need");
  });

  it("extracts multiple labels from complex syntax", () => {
    const labels = extractDiagramLabels("A[Start] --> B{Decision}");
    expect(labels).toContain("Start");
    expect(labels).toContain("Decision");
    expect(labels.length).toBe(2);
  });

  it("skips labels shorter than 2 characters", () => {
    const labels = extractDiagramLabels("A[X] --> B[Go]");
    expect(labels).not.toContain("X");
    expect(labels).toContain("Go");
  });

  it("returns empty array for plain text without diagram syntax", () => {
    const labels = extractDiagramLabels("just plain text");
    expect(labels).toEqual([]);
  });

  it("trims whitespace from extracted labels", () => {
    const labels = extractDiagramLabels("A[ Padded Label ]");
    expect(labels).toContain("Padded Label");
  });
});

describe("getCodeBlockLineOverlayPosition", () => {
  it("finds correct line index for search text in code block", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "line one\nline two\nline three\nline four\nline five";
    pre.appendChild(code);
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "line three");
    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(2);

    document.body.removeChild(pre);
  });

  it("reads lineHeight from code element, not pre", () => {
    const pre = document.createElement("pre");
    pre.style.lineHeight = "24px";
    pre.style.paddingTop = "16px";
    const code = document.createElement("code");
    code.style.lineHeight = "19px";
    code.textContent = "line one\nline two\nline three\nline four\nline five";
    pre.appendChild(code);
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "line three");
    expect(result).not.toBeNull();
    // top = paddingTop(16) + lineIndex(2) * codeLineHeight(19) = 54
    expect(result!.top).toBe(16 + 2 * 19);
    expect(result!.height).toBe(19);

    document.body.removeChild(pre);
  });

  it("returns null when text not found in pre", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "line one\nline two\nline three";
    pre.appendChild(code);
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "nonexistent");
    expect(result).toBeNull();

    document.body.removeChild(pre);
  });

  it("uses fallback lineHeight when code element missing", () => {
    const pre = document.createElement("pre");
    pre.style.lineHeight = "22px";
    pre.style.paddingTop = "10px";
    pre.textContent = "line one\nline two\nline three";
    document.body.appendChild(pre);

    const result = getCodeBlockLineOverlayPosition(pre, "line two");
    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(1);
    // Falls back to pre's own lineHeight: top = 10 + 1 * 22 = 32
    expect(result!.top).toBe(10 + 1 * 22);
    expect(result!.height).toBe(22);

    document.body.removeChild(pre);
  });
});
