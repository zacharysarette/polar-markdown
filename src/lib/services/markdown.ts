import { Marked } from "marked";
import hljs from "highlight.js";
import mermaid from "mermaid";
import { convertFileSrc } from "@tauri-apps/api/core";
import { renderAsciiDiagram } from "./filesystem";

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

/** Switch mermaid between dark/light themes. Call when app theme changes. */
export function setMermaidTheme(themeType: "aurora" | "glacier"): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: themeType === "aurora" ? "dark" : "default",
    securityLevel: "loose",
  });
}

// Unicode characters that unambiguously indicate an ASCII art diagram
const DIAGRAM_CHARS = /[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╭╮╰╯→←↑↓┊┆]/;

function looksLikeDiagram(text: string): boolean {
  return DIAGRAM_CHARS.test(text);
}

function toBobBlock(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre class="bob">${escaped}</pre>`;
}

/** Extract the directory portion of a file path (handles / and \). */
export function getDirectory(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return lastSlash === -1 ? "" : filePath.substring(0, lastSlash);
}

/** Join base directory with a relative path, resolving . and .. segments. */
export function resolvePath(base: string, relative: string): string {
  // Normalize to forward slashes for processing
  const baseParts = base.replace(/\\/g, "/").split("/").filter(Boolean);
  const relParts = relative.replace(/\\/g, "/").split("/").filter(Boolean);

  const result = [...baseParts];
  for (const part of relParts) {
    if (part === ".") continue;
    if (part === "..") {
      result.pop();
    } else {
      result.push(part);
    }
  }

  // Preserve leading slash for absolute paths
  const prefix = base.replace(/\\/g, "/").startsWith("/") ? "/" : "";
  return prefix + result.join("/");
}

/** Resolve an image src — pass through external URLs, resolve relative paths via asset protocol. */
export function resolveImageSrc(href: string, markdownDir: string): string {
  if (/^https?:\/\//i.test(href) || /^data:/i.test(href)) {
    return href;
  }
  if (!markdownDir) return href;
  const absolutePath = resolvePath(markdownDir, href);
  return convertFileSrc(absolutePath);
}

/** Convert heading text to a URL-friendly slug for anchor links. */
export function slugify(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")       // strip bold **text**
    .replace(/\*(.+?)\*/g, "$1")            // strip italic *text*
    .replace(/`(.+?)`/g, "$1")              // strip inline code `text`
    .replace(/!\[.*?\]\(.*?\)/g, "")        // strip images ![alt](url)
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")     // strip links [text](url)
    .replace(/~~(.+?)~~/g, "$1")            // strip strikethrough ~~text~~
    .replace(/<[^>]+>/g, "")                // strip HTML tags
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")               // remove non-alphanumeric (keep hyphens, underscores)
    .replace(/\s+/g, "-")                   // spaces to hyphens
    .replace(/-+/g, "-")                    // collapse multiple hyphens
    .replace(/^-|-$/g, "");                 // strip leading/trailing hyphens
}

// Track duplicate heading slugs for unique IDs within a single render
let slugCounts = new Map<string, number>();

function getUniqueSlug(slug: string): string {
  const count = slugCounts.get(slug) ?? 0;
  slugCounts.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
}

// Track the current markdown file's directory for image resolution
let currentMarkdownDir = "";

// Track whether to use dark or light theme for svgbob diagrams
let bobDarkMode = true;

/** Set svgbob dark mode. Called when app theme changes. */
export function setBobDarkMode(dark: boolean): void {
  bobDarkMode = dark;
}

function wrapWithLineNumbers(highlighted: string, text: string, langClass: string): string {
  const lineCount = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
  const lineRows = '<span></span>'.repeat(lineCount);
  return `<pre class="line-numbers"><code class="hljs ${langClass}">${highlighted}</code><span class="line-numbers-rows" aria-hidden="true">${lineRows}</span></pre>`;
}

// Create a configured Marked instance with syntax highlighting and mermaid support
const marked = new Marked({
  hooks: {
    postprocess(html) {
      return html
        .replace(/<table>/g, '<div class="table-wrapper"><table>')
        .replace(/<\/table>/g, '</table></div>');
    },
  },
  renderer: {
    heading({ tokens, depth, text }: { tokens: any[]; depth: number; text: string }) {
      const slug = getUniqueSlug(slugify(text));
      const content = (this as any).parser.parseInline(tokens);
      return `<h${depth} id="${slug}">${content}</h${depth}>\n`;
    },
    image({ href, title, text }: { href: string; title?: string | null; text: string }) {
      const resolvedHref = resolveImageSrc(href, currentMarkdownDir);
      const altAttr = text ? ` alt="${text}"` : ' alt=""';
      const titleAttr = title ? ` title="${title}"` : "";
      const onerror = `this.classList.add('img-broken');this.alt=this.alt||'Image not found'`;
      return `<img src="${resolvedHref}"${altAttr}${titleAttr} loading="lazy" onerror="${onerror}">`;
    },
    code({ text, lang }: { text: string; lang?: string }) {
      // Mermaid blocks get rendered as pre.mermaid for mermaid.run() to pick up
      if (lang === "mermaid") {
        return `<pre class="mermaid">${text}</pre>`;
      }

      // Explicitly tagged bob/ascii blocks
      if (lang === "bob" || lang === "svgbob" || lang === "ascii-diagram") {
        return toBobBlock(text);
      }

      // All tagged code gets syntax highlighted
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(text, { language: lang }).value;
        return wrapWithLineNumbers(highlighted, text, 'language-' + lang);
      }

      // Auto-detect: unlabeled blocks with box-drawing/arrow Unicode chars are diagrams
      if (!lang && looksLikeDiagram(text)) {
        return toBobBlock(text);
      }

      // Fallback: auto-detect language
      const highlighted = hljs.highlightAuto(text).value;
      return wrapWithLineNumbers(highlighted, text, '');
    },
  },
});

export async function renderMarkdown(content: string, filePath?: string): Promise<string> {
  slugCounts = new Map<string, number>();
  currentMarkdownDir = filePath ? getDirectory(filePath) : "";
  return marked.parse(content) as Promise<string>;
}

export async function renderMermaidDiagrams(): Promise<void> {
  await mermaid.run({ querySelector: "pre.mermaid" });
}

export async function renderBobDiagrams(): Promise<void> {
  const elements = document.querySelectorAll("pre.bob");
  for (const el of elements) {
    const text = el.textContent ?? "";
    if (!text.trim()) continue;
    try {
      const svg = await renderAsciiDiagram(text, bobDarkMode);
      el.innerHTML = svg;
      el.classList.remove("bob");
      el.classList.add("bob-rendered");
    } catch {
      // Leave as plain text if rendering fails
    }
  }
}
