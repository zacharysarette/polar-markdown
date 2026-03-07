import { describe, it, expect } from "vitest";
import { computeDocumentStats, countSyllables } from "./doc-stats";

describe("computeDocumentStats", () => {
  describe("basic counting", () => {
    it("returns zeros for empty string", () => {
      const stats = computeDocumentStats("");
      expect(stats.words).toBe(0);
      expect(stats.characters).toBe(0);
      expect(stats.charactersNoSpaces).toBe(0);
      expect(stats.lines).toBe(0);
      expect(stats.sentences).toBe(0);
      expect(stats.paragraphs).toBe(0);
    });

    it("counts a single word", () => {
      const stats = computeDocumentStats("Hello");
      expect(stats.words).toBe(1);
      expect(stats.characters).toBe(5);
      expect(stats.charactersNoSpaces).toBe(5);
      expect(stats.lines).toBe(1);
    });

    it("counts multiple words", () => {
      const stats = computeDocumentStats("Hello world foo bar");
      expect(stats.words).toBe(4);
    });

    it("counts multiple lines", () => {
      const stats = computeDocumentStats("line one\nline two\nline three");
      expect(stats.lines).toBe(3);
    });

    it("counts characters with and without spaces", () => {
      const stats = computeDocumentStats("a b c");
      expect(stats.characters).toBe(5);
      expect(stats.charactersNoSpaces).toBe(3);
    });

    it("counts paragraphs separated by blank lines", () => {
      const stats = computeDocumentStats("Para one.\n\nPara two.\n\nPara three.");
      expect(stats.paragraphs).toBe(3);
    });

    it("counts a single paragraph with no blank lines", () => {
      const stats = computeDocumentStats("Just one paragraph here.");
      expect(stats.paragraphs).toBe(1);
    });
  });

  describe("sentence detection", () => {
    it("counts sentences ending with period", () => {
      const stats = computeDocumentStats("First sentence. Second sentence.");
      expect(stats.sentences).toBe(2);
    });

    it("counts sentences ending with exclamation", () => {
      const stats = computeDocumentStats("Wow! Amazing!");
      expect(stats.sentences).toBe(2);
    });

    it("counts sentences ending with question mark", () => {
      const stats = computeDocumentStats("Is this working? Yes it is.");
      expect(stats.sentences).toBe(2);
    });

    it("does not double-count multiple punctuation", () => {
      const stats = computeDocumentStats("Really?! Yes!!!");
      expect(stats.sentences).toBe(2);
    });

    it("returns at least 1 sentence for non-empty text without terminal punctuation", () => {
      const stats = computeDocumentStats("Hello world");
      expect(stats.sentences).toBe(1);
    });
  });

  describe("reading time", () => {
    it("returns 1 min for a single word", () => {
      const stats = computeDocumentStats("Hello");
      expect(stats.readingTimeMinutes).toBe(1);
    });

    it("returns 1 min for exactly 200 words", () => {
      const text = Array(200).fill("word").join(" ");
      const stats = computeDocumentStats(text);
      expect(stats.readingTimeMinutes).toBe(1);
    });

    it("returns 2 min for 201 words", () => {
      const text = Array(201).fill("word").join(" ");
      const stats = computeDocumentStats(text);
      expect(stats.readingTimeMinutes).toBe(2);
    });

    it("returns 0 min for empty text", () => {
      const stats = computeDocumentStats("");
      expect(stats.readingTimeMinutes).toBe(0);
    });
  });

  describe("markdown stripping", () => {
    it("strips code blocks from word count", () => {
      const stats = computeDocumentStats("Hello world.\n\n```js\nconst x = 1;\n```\n\nGoodbye.");
      // "Hello world" + "Goodbye" = words from prose only
      expect(stats.words).toBe(3);
    });

    it("strips headings markers", () => {
      const stats = computeDocumentStats("# Hello World");
      expect(stats.words).toBe(2);
    });

    it("strips bold and italic markers", () => {
      const stats = computeDocumentStats("This is **bold** and *italic* text.");
      expect(stats.words).toBe(6);
    });

    it("strips HTML tags", () => {
      const stats = computeDocumentStats("Hello <em>world</em> today.");
      expect(stats.words).toBe(3);
    });

    it("strips frontmatter", () => {
      const stats = computeDocumentStats("---\ntitle: Test\n---\n\nHello world.");
      expect(stats.words).toBe(2);
    });

    it("handles document with only code blocks", () => {
      const stats = computeDocumentStats("```\ncode only\n```");
      expect(stats.words).toBe(0);
    });

    it("handles document with only headings", () => {
      const stats = computeDocumentStats("# Title\n## Subtitle");
      expect(stats.words).toBe(2);
    });
  });
});

describe("countSyllables", () => {
  it("counts 'the' as 1 syllable", () => {
    expect(countSyllables("the")).toBe(1);
  });

  it("counts 'hello' as 2 syllables", () => {
    expect(countSyllables("hello")).toBe(2);
  });

  it("counts 'beautiful' as 3 syllables", () => {
    expect(countSyllables("beautiful")).toBe(3);
  });

  it("counts 'cake' as 1 syllable (silent e)", () => {
    expect(countSyllables("cake")).toBe(1);
  });

  it("counts 'a' as 1 syllable", () => {
    expect(countSyllables("a")).toBe(1);
  });

  it("counts 'queue' as 1 syllable", () => {
    expect(countSyllables("queue")).toBe(1);
  });

  it("counts 'people' as 2 syllables", () => {
    expect(countSyllables("people")).toBe(2);
  });
});

describe("Flesch scores", () => {
  it("gives high reading ease for simple text", () => {
    // Simple short sentences with simple words
    const text = "The cat sat. The dog ran. The sun is hot. I am big. We go now.";
    const stats = computeDocumentStats(text);
    expect(stats.fleschReadingEase).toBeGreaterThan(70);
    expect(stats.fleschKincaidGrade).toBeLessThan(5);
  });

  it("gives lower reading ease for complex text", () => {
    const text = "The implementation of sophisticated algorithmic methodologies necessitates comprehensive understanding of computational complexity. Furthermore, the interdisciplinary amalgamation of heterogeneous paradigms facilitates unprecedented advancement.";
    const stats = computeDocumentStats(text);
    expect(stats.fleschReadingEase).toBeLessThan(30);
    expect(stats.fleschKincaidGrade).toBeGreaterThan(12);
  });

  it("clamps reading ease to 0-100", () => {
    const stats = computeDocumentStats("Go.");
    expect(stats.fleschReadingEase).toBeGreaterThanOrEqual(0);
    expect(stats.fleschReadingEase).toBeLessThanOrEqual(100);
  });

  it("clamps grade to minimum 0", () => {
    const stats = computeDocumentStats("Go.");
    expect(stats.fleschKincaidGrade).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 scores for empty text", () => {
    const stats = computeDocumentStats("");
    expect(stats.fleschReadingEase).toBe(0);
    expect(stats.fleschKincaidGrade).toBe(0);
  });
});
