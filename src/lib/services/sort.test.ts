import { describe, it, expect } from "vitest";
import { sortEntries, type SortMode } from "./sort";
import type { FileEntry } from "../types";

function makeEntry(name: string, opts: Partial<FileEntry> = {}): FileEntry {
  return {
    name,
    path: `/${name}`,
    is_directory: false,
    children: [],
    ...opts,
  };
}

const sampleEntries: FileEntry[] = [
  makeEntry("beta.md", { modified: 200 }),
  makeEntry("alpha.md", { modified: 300 }),
  makeEntry("gamma.md", { modified: 100 }),
];

describe("sortEntries", () => {
  it("sorts by name ascending", () => {
    const result = sortEntries(sampleEntries, "name-asc");
    expect(result.map((e) => e.name)).toEqual(["alpha.md", "beta.md", "gamma.md"]);
  });

  it("sorts by name descending", () => {
    const result = sortEntries(sampleEntries, "name-desc");
    expect(result.map((e) => e.name)).toEqual(["gamma.md", "beta.md", "alpha.md"]);
  });

  it("sorts by modified descending (newest first)", () => {
    const result = sortEntries(sampleEntries, "modified-desc");
    expect(result.map((e) => e.name)).toEqual(["alpha.md", "beta.md", "gamma.md"]);
  });

  it("sorts by modified ascending (oldest first)", () => {
    const result = sortEntries(sampleEntries, "modified-asc");
    expect(result.map((e) => e.name)).toEqual(["gamma.md", "beta.md", "alpha.md"]);
  });

  it("directories always come before files regardless of sort mode", () => {
    const entries: FileEntry[] = [
      makeEntry("zebra.md", { modified: 999 }),
      makeEntry("docs", { is_directory: true, children: [], modified: 1 }),
    ];
    for (const mode of ["name-asc", "name-desc", "modified-desc", "modified-asc"] as SortMode[]) {
      const result = sortEntries(entries, mode);
      expect(result[0].name, `failed for mode ${mode}`).toBe("docs");
    }
  });

  it("recursively sorts children", () => {
    const entries: FileEntry[] = [
      makeEntry("docs", {
        is_directory: true,
        path: "/docs",
        children: [
          makeEntry("charlie.md", { path: "/docs/charlie.md" }),
          makeEntry("alice.md", { path: "/docs/alice.md" }),
        ],
      }),
    ];
    const result = sortEntries(entries, "name-asc");
    expect(result[0].children.map((e) => e.name)).toEqual(["alice.md", "charlie.md"]);
  });
});
