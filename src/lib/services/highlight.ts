/**
 * Calculate the overlay position for highlighting a line in a code block.
 * Reads lineHeight from the <code> child (which has the actual font metrics),
 * NOT from <pre> (which inherits a different line-height from :root).
 */
export function getCodeBlockLineOverlayPosition(
  pre: HTMLElement,
  searchText: string
): { top: number; height: number; lineIndex: number } | null {
  const tc = pre.textContent ?? "";
  if (!tc.includes(searchText)) return null;

  const lines = tc.split("\n");
  let targetLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchText)) {
      targetLineIdx = i;
      break;
    }
  }
  if (targetLineIdx === -1) return null;

  // Read lineHeight from <code> child (which has the actual font metrics),
  // NOT from <pre> (which inherits a different line-height from :root).
  const codeEl = pre.querySelector("code") || pre;
  const lineHeight = parseFloat(getComputedStyle(codeEl).lineHeight) || 20;
  const paddingTop = parseFloat(getComputedStyle(pre).paddingTop) || 0;

  return {
    top: paddingTop + targetLineIdx * lineHeight,
    height: lineHeight,
    lineIndex: targetLineIdx,
  };
}

/**
 * Extract meaningful labels from diagram source syntax.
 * Mermaid source like `C --> E[View in App]` renders as SVG with label "View in App".
 * This extracts text from brackets, parens, curlies, and after colons.
 */
export function extractDiagramLabels(text: string): string[] {
  const labels: string[] = [];
  // Match text within [...], (...), {...}
  const re = /[\[({](.*?)[\])}]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const label = m[1].trim();
    if (label.length > 1) labels.push(label);
  }
  // Match text after ": " (sequence diagram messages)
  const colonMatch = text.match(/:\s+(.+)/);
  if (colonMatch) {
    const msg = colonMatch[1].trim();
    if (msg.length > 1) labels.push(msg);
  }
  return labels;
}
