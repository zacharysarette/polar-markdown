import { slugify } from "./markdown";
import type { TocEntry } from "../types";
import { marked } from "marked";

/** Strip inline markdown formatting from heading text for display. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")
    .replace(/<[^>]+>/g, "");
}

/** Extract heading entries from markdown content for table of contents. */
export function extractHeadings(content: string): TocEntry[] {
  if (!content) return [];

  const tokens = marked.lexer(content);
  const slugCounts = new Map<string, number>();
  const entries: TocEntry[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      const text = stripInlineMarkdown((token as any).text);
      const baseSlug = slugify((token as any).text);
      const count = slugCounts.get(baseSlug) ?? 0;
      slugCounts.set(baseSlug, count + 1);
      const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
      entries.push({ text, slug, depth: (token as any).depth });
    }
  }

  return entries;
}
