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

/**
 * Strip markdown syntax from a raw markdown line, leaving only the visible text content.
 * Used to match editor lines against rendered DOM text.
 *
 * IMPORTANT: Inline code must be stripped FIRST (before italic/bold) because
 * content inside backticks (e.g. `get_docs_path()`) contains underscores that
 * would be incorrectly matched by the italic regex `_(.+?)_`.
 */
export function stripMarkdownSyntax(text: string): string {
  return text
    // Leading whitespace (indented list items)
    .replace(/^\s+/, '')
    // Headings
    .replace(/^#{1,6}\s+/, '')
    // Task list markers (must come before list markers)
    .replace(/^[-*+]\s+\[[ x]\]\s+/i, '')
    // Unordered list markers
    .replace(/^[-*+]\s+/, '')
    // Ordered list markers
    .replace(/^\d+\.\s+/, '')
    // Blockquote markers
    .replace(/^>\s*/, '')
    // Inline code — MUST come before bold/italic to protect underscores inside code spans
    .replace(/`([^`]+)`/g, '$1')
    // Images with optional title: ![alt](url "title")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Bold (** and __)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '$1')
    // Italic (* and _) — use word-boundary-aware regex to avoid matching underscores in identifiers
    .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    // Table pipe characters
    .replace(/\|/g, ' ')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Determine which table cell (0-indexed) the cursor column falls into.
 * Returns -1 if the line is not a table row or is a separator line.
 */
export function getTableCellIndex(lineText: string, column: number): number {
  // Must start with | to be a table row
  if (!lineText.trimStart().startsWith('|')) return -1;
  // Separator lines like |---|---|---| are not data rows
  if (/^\s*\|[\s\-:|]+\|\s*$/.test(lineText)) return -1;

  let cellIndex = -1;
  for (let i = 0; i < column && i < lineText.length; i++) {
    if (lineText[i] === '|') {
      cellIndex++;
    }
  }
  return Math.max(0, cellIndex);
}

/**
 * Find the best matching block-level element whose textContent contains the target text.
 * Searches p, h1-h6, li, td, th, dd, dt elements, skipping those inside <pre>.
 *
 * When positionRatio (0..1) is provided and multiple elements match, picks the one
 * closest to the expected document position. This prevents matching the wrong element
 * when similar text appears at multiple locations (e.g. repeated heading text).
 *
 * For table rows (where stripped text = "cell1 cell2 cell3"), we also try matching
 * individual words/phrases against td/th cells. When cellIndex is provided, returns
 * the specific cell at that index instead of the first cell.
 */
export function findMatchingBlockElement(
  container: HTMLElement,
  text: string,
  positionRatio?: number,
  cellIndex?: number,
): HTMLElement | null {
  const blockSelectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th, dd, dt';
  const allBlocks = Array.from(container.querySelectorAll(blockSelectors));
  const nonPreBlocks = allBlocks.filter(b => !b.closest('pre'));

  // First pass: exact substring match in textContent
  const matches: { element: HTMLElement; index: number }[] = [];
  for (let i = 0; i < nonPreBlocks.length; i++) {
    const tc = (nonPreBlocks[i].textContent ?? '').trim();
    if (tc.includes(text)) {
      matches.push({ element: nonPreBlocks[i] as HTMLElement, index: i });
    }
  }

  if (matches.length > 0) {
    // Single match or no position info → return first match (backward compatible)
    if (matches.length === 1 || positionRatio === undefined) {
      return matches[0].element;
    }
    // Multiple matches + position info → pick the one closest to expected position
    return pickClosestByPosition(nonPreBlocks.length, matches, positionRatio);
  }

  // Second pass: for table row lines, try matching individual cell content.
  // A stripped table row like "Feature Status Notes" won't match any single <th>/<td>,
  // but the individual words match separate cells. Find a <tr> where most cells match.
  const cells = text.split(/\s{2,}|\s+/).filter(w => w.length > 1);
  if (cells.length >= 2) {
    const rows = container.querySelectorAll('tr');
    for (const row of rows) {
      const cellEls = row.querySelectorAll('td, th');
      if (cellEls.length === 0) continue;
      let matchCount = 0;
      for (const cell of cellEls) {
        const cellText = (cell.textContent ?? '').trim();
        if (cells.some(c => cellText.includes(c))) matchCount++;
      }
      // If most cells match, highlight the targeted cell (or first if no index)
      if (matchCount >= Math.ceil(cellEls.length * 0.5)) {
        if (cellIndex !== undefined && cellIndex >= 0 && cellIndex < cellEls.length) {
          return cellEls[cellIndex] as HTMLElement;
        }
        return cellEls[0] as HTMLElement;
      }
    }
  }

  return null;
}

/**
 * Pick the matching element whose document-order position is closest to the expected ratio.
 */
function pickClosestByPosition(
  totalBlocks: number,
  matches: { element: HTMLElement; index: number }[],
  positionRatio: number,
): HTMLElement {
  let bestMatch = matches[0].element;
  let bestDistance = Infinity;

  for (const m of matches) {
    const matchRatio = totalBlocks > 1 ? m.index / (totalBlocks - 1) : 0;
    const distance = Math.abs(matchRatio - positionRatio);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = m.element;
    }
  }

  return bestMatch;
}

/**
 * Find a <pre> element whose textContent contains the given line text.
 * Used for active line highlighting when the cursor is inside a code block or diagram.
 */
export function findMatchingPreElement(container: HTMLElement, text: string): HTMLElement | null {
  const pres = container.querySelectorAll('pre');
  for (const pre of pres) {
    const tc = pre.textContent ?? '';
    if (tc.includes(text)) {
      return pre as HTMLElement;
    }
  }
  return null;
}

/**
 * Apply a highlight class to the block-level element that matches the given text.
 * Returns true if a match was found and highlighted.
 */
export function applyBlockHighlight(container: HTMLElement, text: string, className: string): boolean {
  const block = findMatchingBlockElement(container, text);
  if (!block) return false;
  block.classList.add(className);
  return true;
}

/**
 * Remove a highlight class from all elements in the container.
 */
export function clearBlockHighlights(container: HTMLElement, className: string): void {
  container.querySelectorAll(`.${className}`).forEach((el) => {
    el.classList.remove(className);
  });
}
