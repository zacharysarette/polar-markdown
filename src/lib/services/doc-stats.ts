export interface DocumentStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  readingTimeMinutes: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
}

function stripMarkdownForReadability(text: string): string {
  let result = text;
  // Remove frontmatter
  result = result.replace(/^---\n[\s\S]*?\n---\n?/, "");
  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, "");
  result = result.replace(/`[^`\n]+`/g, (m) => m.slice(1, -1));
  // Remove HTML tags
  result = result.replace(/<[^>]+>/g, "");
  // Remove heading markers
  result = result.replace(/^#{1,6}\s+/gm, "");
  // Remove bold/italic markers
  result = result.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  result = result.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");
  // Remove link syntax
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove images
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}\s*$/gm, "");
  // Remove blockquote markers
  result = result.replace(/^>\s*/gm, "");
  // Remove list markers
  result = result.replace(/^[\s]*[-*+]\s+/gm, "");
  result = result.replace(/^[\s]*\d+\.\s+/gm, "");
  return result;
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 2) return 1;

  // Count vowel groups
  let count = 0;
  let prevVowel = false;
  const vowels = "aeiouy";
  for (const ch of w) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Silent e at end
  if (w.endsWith("e") && !w.endsWith("le") && count > 1) count--;
  // -ed ending (unless preceded by d or t)
  if (w.endsWith("ed") && w.length > 3 && !w.endsWith("ted") && !w.endsWith("ded") && count > 1) count--;

  return Math.max(1, count);
}

export function computeDocumentStats(rawMarkdown: string): DocumentStats {
  if (!rawMarkdown.trim()) {
    return {
      words: 0, characters: 0, charactersNoSpaces: 0, lines: 0,
      sentences: 0, paragraphs: 0, readingTimeMinutes: 0,
      fleschReadingEase: 0, fleschKincaidGrade: 0,
    };
  }

  // Raw counts (before stripping markdown)
  const characters = rawMarkdown.length;
  const charactersNoSpaces = rawMarkdown.replace(/\s/g, "").length;
  const lines = rawMarkdown.split("\n").length;

  // Strip markdown for readability analysis
  const stripped = stripMarkdownForReadability(rawMarkdown);
  const cleanWords = stripped.split(/\s+/).filter((w) => w.length > 0);
  const words = cleanWords.length;

  // Paragraphs: groups of non-blank lines separated by blank lines
  const paragraphs = stripped
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length || (words > 0 ? 1 : 0);

  // Sentences: count terminal punctuation, but collapse consecutive punctuation
  const sentenceMatches = stripped.match(/[.!?]+(\s|$)/g);
  const sentences = sentenceMatches ? sentenceMatches.length : (words > 0 ? 1 : 0);

  // Reading time: 200 wpm, ceil, min 1 for non-empty
  const readingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(words / 200)) : 0;

  // Syllable count for Flesch formulas
  let totalSyllables = 0;
  for (const w of cleanWords) {
    totalSyllables += countSyllables(w);
  }

  // Flesch Reading Ease & Kincaid Grade
  let fleschReadingEase = 0;
  let fleschKincaidGrade = 0;
  if (words > 0 && sentences > 0) {
    const avgSentenceLen = words / sentences;
    const avgSyllablesPerWord = totalSyllables / words;
    fleschReadingEase = 206.835 - 1.015 * avgSentenceLen - 84.6 * avgSyllablesPerWord;
    fleschReadingEase = Math.round(Math.min(100, Math.max(0, fleschReadingEase)) * 10) / 10;
    fleschKincaidGrade = 0.39 * avgSentenceLen + 11.8 * avgSyllablesPerWord - 15.59;
    fleschKincaidGrade = Math.round(Math.max(0, fleschKincaidGrade) * 10) / 10;
  }

  return {
    words, characters, charactersNoSpaces, lines,
    sentences, paragraphs, readingTimeMinutes,
    fleschReadingEase, fleschKincaidGrade,
  };
}
