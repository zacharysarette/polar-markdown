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
function resolvePath(base: string, relative: string): string {
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

// Track the current markdown file's directory for image resolution
let currentMarkdownDir = "";

function wrapWithLineNumbers(highlighted: string, text: string, langClass: string): string {
  const lineCount = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
  const lineRows = '<span></span>'.repeat(lineCount);
  return `<pre class="line-numbers"><code class="hljs ${langClass}">${highlighted}</code><span class="line-numbers-rows" aria-hidden="true">${lineRows}</span></pre>`;
}

// Create a configured Marked instance with syntax highlighting and mermaid support
const marked = new Marked({
  renderer: {
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
      const svg = await renderAsciiDiagram(text);
      el.innerHTML = svg;
      el.classList.remove("bob");
      el.classList.add("bob-rendered");
    } catch {
      // Leave as plain text if rendering fails
    }
  }
}
