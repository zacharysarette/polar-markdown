import { Marked } from "marked";
import hljs from "highlight.js";
import mermaid from "mermaid";

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

// Create a configured Marked instance with syntax highlighting and mermaid support
const marked = new Marked({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      // Mermaid blocks get rendered as pre.mermaid for mermaid.run() to pick up
      if (lang === "mermaid") {
        return `<pre class="mermaid">${text}</pre>`;
      }

      // All other code gets syntax highlighted
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(text, { language: lang }).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      }

      // Fallback: auto-detect language
      const highlighted = hljs.highlightAuto(text).value;
      return `<pre><code class="hljs">${highlighted}</code></pre>`;
    },
  },
});

export async function renderMarkdown(content: string): Promise<string> {
  return marked.parse(content) as Promise<string>;
}

export async function renderMermaidDiagrams(): Promise<void> {
  await mermaid.run({ querySelector: "pre.mermaid" });
}
