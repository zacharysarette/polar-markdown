import { Marked } from "marked";
import hljs from "highlight.js";
import { convertFileSrc } from "@tauri-apps/api/core";
import { renderAsciiDiagram } from "./filesystem";

// Lazy-loaded mermaid instance
let mermaidInstance: any = null;
let pendingTheme: "dark" | "default" = "dark";

async function getMermaid(): Promise<any> {
  if (!mermaidInstance) {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      startOnLoad: false,
      theme: pendingTheme,
      securityLevel: "loose",
    });
    mermaidInstance = mermaid;
  }
  return mermaidInstance;
}

/** Switch mermaid between dark/light themes. Call when app theme changes. */
export function setMermaidTheme(themeType: "aurora" | "glacier"): void {
  pendingTheme = themeType === "aurora" ? "dark" : "default";
  if (mermaidInstance) {
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: pendingTheme,
      securityLevel: "loose",
    });
  }
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

/** Reset the slug deduplication counter. Call before processing a new document. */
export function resetSlugCounts(): void {
  slugCounts = new Map<string, number>();
}

/** Get a unique slug, appending -1, -2, etc. for duplicates. Shared by markdown renderer and TOC. */
export function getUniqueSlug(slug: string): string {
  const count = slugCounts.get(slug) ?? 0;
  slugCounts.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
}

// Track the current markdown file's directory for image resolution
let currentMarkdownDir = "";

// Track whether to use dark or light theme for svgbob diagrams
let bobDarkMode = true;

// Track whether source line number attributes should be emitted
let sourceLineNumbersEnabled = false;

// Map from token index to source line number (populated during two-phase render)
let tokenLineMap = new Map<number, number>();
let tokenIndex = 0;

/** Set svgbob dark mode. Called when app theme changes. */
export function setBobDarkMode(dark: boolean): void {
  bobDarkMode = dark;
}

/** Get data-source-line attribute string if source line numbers are enabled for this token. */
function getSourceLineAttr(token: any): string {
  if (!sourceLineNumbersEnabled) return "";
  const line = token?._sourceLine;
  if (line == null) return "";
  return ` data-source-line="${line}"`;
}

function wrapWithLineNumbers(highlighted: string, text: string, langClass: string, lineAttr = ""): string {
  const lineCount = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
  const lineRows = '<span></span>'.repeat(lineCount);
  return `<pre class="line-numbers"${lineAttr}><code class="hljs ${langClass}">${highlighted}</code><span class="line-numbers-rows" aria-hidden="true">${lineRows}</span></pre>`;
}

// Wiki-style [[link]] extension for marked
const wikiLinkExtension = {
  name: "wikilink",
  level: "inline" as const,
  start(src: string) {
    return src.indexOf("[[");
  },
  tokenizer(src: string) {
    const match = src.match(/^\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/);
    if (match) {
      const target = match[1].trim();
      if (!target) return undefined;
      return {
        type: "wikilink",
        raw: match[0],
        target,
        alias: match[2]?.trim() || null,
      };
    }
    return undefined;
  },
  renderer(token: any) {
    const target = token.target;
    const alias = token.alias || target;
    const href = target.endsWith(".md") ? target : `${target}.md`;
    const encoded = encodeURIComponent(href);
    return `<a href="${encoded}" class="wikilink">${alias}</a>`;
  },
};

// Create a configured Marked instance with syntax highlighting and mermaid support
const marked = new Marked({
  hooks: {
    postprocess(html) {
      return html
        .replace(/<table([^>]*)>/g, '<div class="table-wrapper"><table$1>')
        .replace(/<\/table>/g, '</table></div>');
    },
  },
  renderer: {
    heading(token: any) {
      const { tokens, depth, text } = token;
      const slug = getUniqueSlug(slugify(text));
      const content = (this as any).parser.parseInline(tokens);
      return `<h${depth} id="${slug}"${getSourceLineAttr(token)}>${content}</h${depth}>\n`;
    },
    image({ href, title, text }: { href: string; title?: string | null; text: string }) {
      const resolvedHref = resolveImageSrc(href, currentMarkdownDir);
      const altAttr = text ? ` alt="${text}"` : ' alt=""';
      const titleAttr = title ? ` title="${title}"` : "";
      const onerror = `this.classList.add('img-broken');this.alt=this.alt||'Image not found'`;
      return `<img src="${resolvedHref}"${altAttr}${titleAttr} loading="lazy" onerror="${onerror}">`;
    },
    code(token: any) {
      const { text, lang } = token;
      const lineAttr = getSourceLineAttr(token);
      // Mermaid blocks get rendered as pre.mermaid for mermaid.run() to pick up
      if (lang === "mermaid") {
        return `<pre class="mermaid"${lineAttr}>${text}</pre>`;
      }

      // Explicitly tagged bob/ascii blocks
      if (lang === "bob" || lang === "svgbob" || lang === "ascii-diagram") {
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<pre class="bob"${lineAttr}>${escaped}</pre>`;
      }

      // All tagged code gets syntax highlighted
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(text, { language: lang }).value;
        return wrapWithLineNumbers(highlighted, text, 'language-' + lang, lineAttr);
      }

      // Auto-detect: unlabeled blocks with box-drawing/arrow Unicode chars are diagrams
      if (!lang && looksLikeDiagram(text)) {
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<pre class="bob"${lineAttr}>${escaped}</pre>`;
      }

      // Fallback: auto-detect language
      const highlighted = hljs.highlightAuto(text).value;
      return wrapWithLineNumbers(highlighted, text, '', lineAttr);
    },
    paragraph(token: any) {
      const content = (this as any).parser.parseInline(token.tokens);
      return `<p${getSourceLineAttr(token)}>${content}</p>\n`;
    },
    blockquote(token: any) {
      const body = (this as any).parser.parse(token.tokens);
      return `<blockquote${getSourceLineAttr(token)}>\n${body}</blockquote>\n`;
    },
    list(token: any) {
      const tag = token.ordered ? "ol" : "ul";
      const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
      let body = "";
      for (const item of token.items) {
        body += (this as any).listitem(item);
      }
      return `<${tag}${startAttr}${getSourceLineAttr(token)}>\n${body}</${tag}>\n`;
    },
    table(token: any) {
      let header = "";
      let cell = "";
      for (let j = 0; j < token.header.length; j++) {
        const content = (this as any).parser.parseInline(token.header[j].tokens);
        const align = token.align[j];
        const alignAttr = align ? ` align="${align}"` : "";
        cell += `<th${alignAttr}>${content}</th>\n`;
      }
      header += `<tr>\n${cell}</tr>\n`;

      let body = "";
      for (let i = 0; i < token.rows.length; i++) {
        const row = token.rows[i];
        cell = "";
        for (let j = 0; j < row.length; j++) {
          const content = (this as any).parser.parseInline(row[j].tokens);
          const align = token.align[j];
          const alignAttr = align ? ` align="${align}"` : "";
          cell += `<td${alignAttr}>${content}</td>\n`;
        }
        body += `<tr>\n${cell}</tr>\n`;
      }

      return `<table${getSourceLineAttr(token)}>\n<thead>\n${header}</thead>\n<tbody>${body}</tbody>\n</table>\n`;
    },
    hr(token: any) {
      return `<hr${getSourceLineAttr(token)}>\n`;
    },
  },
});

// Register wiki-link extension
marked.use({ extensions: [wikiLinkExtension] });

export interface RenderOptions {
  sourceLineNumbers?: boolean;
}

/** Annotate top-level tokens with _sourceLine based on their position in the source. */
function annotateSourceLines(tokens: any[]): void {
  let line = 1;
  for (const token of tokens) {
    if (token.type === "space") {
      // Count newlines in whitespace tokens but don't annotate them
      if (token.raw) {
        line += (token.raw.match(/\n/g) || []).length;
      }
      continue;
    }
    token._sourceLine = line;
    if (token.raw) {
      line += (token.raw.match(/\n/g) || []).length;
    }
  }
}

export async function renderMarkdown(content: string, filePath?: string, options?: RenderOptions): Promise<string> {
  slugCounts = new Map<string, number>();
  currentMarkdownDir = filePath ? getDirectory(filePath) : "";
  sourceLineNumbersEnabled = options?.sourceLineNumbers === true;

  if (sourceLineNumbersEnabled) {
    const tokens = marked.lexer(content);
    annotateSourceLines(tokens);
    const html = marked.parser(tokens);
    sourceLineNumbersEnabled = false;
    return html;
  }

  sourceLineNumbersEnabled = false;
  return marked.parse(content) as Promise<string>;
}

export interface MermaidDiagnostic {
  blockIndex: number;
  error: string;
}

export interface MermaidRenderResult {
  total: number;
  errorCount: number;
  diagnostics: MermaidDiagnostic[];
}

/** Validate all pre.mermaid blocks without rendering. Returns diagnostics for failed blocks. */
export async function validateMermaidBlocks(): Promise<MermaidDiagnostic[]> {
  const blocks = document.querySelectorAll("pre.mermaid");
  if (blocks.length === 0) return [];

  const mermaid = await getMermaid();
  const diagnostics: MermaidDiagnostic[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].textContent ?? "";
    try {
      await mermaid.parse(text);
    } catch (err: any) {
      diagnostics.push({
        blockIndex: i,
        error: err?.message ?? String(err),
      });
    }
  }

  return diagnostics;
}

let mermaidRenderCounter = 0;

export async function renderMermaidDiagrams(): Promise<MermaidRenderResult> {
  const blocks = document.querySelectorAll("pre.mermaid");
  const total = blocks.length;
  const diagnostics: MermaidDiagnostic[] = [];

  if (total === 0) return { total: 0, errorCount: 0, diagnostics: [] };

  const mermaid = await getMermaid();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as HTMLElement;
    const text = block.textContent ?? "";

    try {
      await mermaid.parse(text);
      // Valid — render it
      const id = `mermaid-render-${mermaidRenderCounter++}`;
      const { svg } = await mermaid.render(id, text);
      block.innerHTML = svg;
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      diagnostics.push({ blockIndex: i, error: errorMsg });

      // Inject error overlay — keep raw source visible
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      block.innerHTML =
        `<div class="mermaid-error">Diagram error: ${errorMsg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` +
        `<code>${escaped}</code>`;
      block.classList.add("mermaid-invalid");
    }
  }

  return { total, errorCount: diagnostics.length, diagnostics };
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
