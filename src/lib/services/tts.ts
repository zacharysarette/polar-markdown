import { marked } from "marked";

export interface TtsSegment {
  text: string;
  sourceLine: number;
}

export type TtsState = "idle" | "playing" | "paused";

const SKIP_CODE_LANGS = new Set(["mermaid", "bob", "svgbob"]);

/** Strip inline markdown formatting for readable TTS output. */
function stripInlineFormatting(text: string): string {
  let result = text;
  // Remove images (keep alt text)
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // Wiki links: [[target|alias]] → alias, [[target]] → target
  result = result.replace(/\[\[([^\]|]+?)\|([^\]]+?)\]\]/g, "$2");
  result = result.replace(/\[\[([^\]]+?)\]\]/g, "$1");
  // Remove link syntax (keep text)
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove bold/italic markers
  result = result.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  result = result.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");
  // Remove strikethrough
  result = result.replace(/~~([^~]+)~~/g, "$1");
  // Remove inline code backticks (keep content)
  result = result.replace(/`([^`\n]+)`/g, "$1");
  // Remove HTML tags
  result = result.replace(/<[^>]+>/g, "");
  return result.trim();
}

/** Walk list items recursively and collect their text. */
function extractListItems(items: any[]): string[] {
  const texts: string[] = [];
  for (const item of items) {
    if (item.text) {
      // item.text may contain nested formatting; first line is the item text
      const firstLine = item.text.split("\n")[0];
      const stripped = stripInlineFormatting(firstLine);
      if (stripped) texts.push(stripped);
    }
  }
  return texts;
}

/** Extract readable text segments from markdown for TTS. */
export function extractReadableText(rawMarkdown: string): TtsSegment[] {
  if (!rawMarkdown.trim()) return [];

  const tokens = marked.lexer(rawMarkdown);
  const segments: TtsSegment[] = [];
  let currentLine = 1;

  for (const token of tokens) {
    const tokenRaw = (token as any).raw ?? "";
    const sourceLine = currentLine;

    // Count newlines in raw to advance line tracker
    const newlines = (tokenRaw.match(/\n/g) || []).length;

    switch (token.type) {
      case "heading": {
        const text = stripInlineFormatting((token as any).text ?? "");
        if (text) segments.push({ text, sourceLine });
        break;
      }
      case "paragraph": {
        const text = stripInlineFormatting((token as any).text ?? "");
        if (text) segments.push({ text, sourceLine });
        break;
      }
      case "blockquote": {
        // Extract text from blockquote tokens
        const bqTokens = (token as any).tokens ?? [];
        for (const bqt of bqTokens) {
          if (bqt.type === "paragraph") {
            const text = stripInlineFormatting(bqt.text ?? "");
            if (text) segments.push({ text, sourceLine });
          }
        }
        break;
      }
      case "list": {
        const items = (token as any).items ?? [];
        const itemTexts = extractListItems(items);
        if (itemTexts.length > 0) {
          segments.push({ text: itemTexts.join(". "), sourceLine });
        }
        break;
      }
      case "table": {
        const header = (token as any).header ?? [];
        const rows = (token as any).rows ?? [];
        for (const row of [header, ...rows]) {
          const cells = row.map((cell: any) => {
            const cellText = cell.text ?? (typeof cell === "string" ? cell : "");
            return stripInlineFormatting(cellText);
          }).filter((t: string) => t);
          if (cells.length > 0) {
            segments.push({ text: cells.join(", "), sourceLine });
          }
        }
        break;
      }
      case "code": {
        // Skip all code blocks (including mermaid, bob, etc.)
        break;
      }
      case "hr":
      case "html":
      case "space":
        // Skip these
        break;
      default:
        // For any other token with text, try to extract it
        if ((token as any).text) {
          const text = stripInlineFormatting((token as any).text);
          if (text) segments.push({ text, sourceLine });
        }
        break;
    }

    currentLine += newlines;
  }

  return segments;
}

export interface TtsControllerCallbacks {
  onSegmentChange?: (index: number) => void;
  onStateChange?: (state: TtsState) => void;
}

export interface TtsController {
  play: (segments: TtsSegment[], voiceName?: string, rate?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getState: () => TtsState;
  setVoice: (name: string) => void;
  setRate: (rate: number) => void;
}

/** Split text at sentence boundaries if it's too long for speechSynthesis. */
function splitLongText(text: string, maxLen: number = 15000): string[] {
  if (text.length <= maxLen) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Create a TTS controller that manages speechSynthesis playback. */
export function createTtsController(callbacks?: TtsControllerCallbacks): TtsController {
  let state: TtsState = "idle";
  let currentSegments: TtsSegment[] = [];
  let currentIndex = 0;
  let stopping = false;
  let voiceName = "";
  let rate = 1.0;

  function setState(newState: TtsState) {
    state = newState;
    callbacks?.onStateChange?.(newState);
  }

  function findVoice(name: string): SpeechSynthesisVoice | null {
    if (!name) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.name === name) ?? null;
  }

  function speakSegment(index: number) {
    if (index >= currentSegments.length || stopping) {
      setState("idle");
      return;
    }

    currentIndex = index;
    callbacks?.onSegmentChange?.(index);

    const segment = currentSegments[index];
    const chunks = splitLongText(segment.text);

    let chunkIndex = 0;

    function speakNextChunk() {
      if (chunkIndex >= chunks.length || stopping) {
        if (!stopping) speakSegment(index + 1);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      utterance.rate = rate;

      const voice = findVoice(voiceName);
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        chunkIndex++;
        speakNextChunk();
      };

      utterance.onerror = (e) => {
        if (e.error === "canceled" || stopping) return;
        // Try next segment on error
        if (!stopping) speakSegment(index + 1);
      };

      window.speechSynthesis.speak(utterance);
    }

    speakNextChunk();
  }

  return {
    play(segments, newVoiceName, newRate) {
      stopping = false;
      window.speechSynthesis.cancel();
      currentSegments = segments;
      currentIndex = 0;
      if (newVoiceName !== undefined) voiceName = newVoiceName;
      if (newRate !== undefined) rate = newRate;
      setState("playing");
      speakSegment(0);
    },
    pause() {
      if (state === "playing") {
        window.speechSynthesis.pause();
        setState("paused");
      }
    },
    resume() {
      if (state === "paused") {
        window.speechSynthesis.resume();
        setState("playing");
      }
    },
    stop() {
      stopping = true;
      window.speechSynthesis.cancel();
      currentSegments = [];
      currentIndex = 0;
      setState("idle");
    },
    getState() {
      return state;
    },
    setVoice(name) {
      voiceName = name;
    },
    setRate(newRate) {
      rate = newRate;
    },
  };
}

/** Get available speech synthesis voices. */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}
