import { describe, it, expect } from "vitest";
import { flattenVisibleEntries, findFirstFile, filterEntries } from "./tree-utils";
import type { FileEntry } from "../types";

const sampleTree: FileEntry[] = [
  {
    name: "docs",
    path: "/docs",
    is_directory: true,
    children: [
      { name: "plan.md", path: "/docs/plan.md", is_directory: false, children: [] },
      { name: "notes.md", path: "/docs/notes.md", is_directory: false, children: [] },
    ],
  },
  { name: "readme.md", path: "/readme.md", is_directory: false, children: [] },
];

describe("flattenVisibleEntries", () => {
  it("returns all top-level entries when nothing is expanded", () => {
    const result = flattenVisibleEntries(sampleTree, new Set());
    expect(result).toEqual(["/docs", "/readme.md"]);
  });

  it("includes children of expanded directories", () => {
    const result = flattenVisibleEntries(sampleTree, new Set(["/docs"]));
    expect(result).toEqual([
      "/docs",
      "/docs/plan.md",
      "/docs/notes.md",
      "/readme.md",
    ]);
  });

  it("returns empty array for empty tree", () => {
    const result = flattenVisibleEntries([], new Set());
    expect(result).toEqual([]);
  });

  it("handles nested expanded directories", () => {
    const deepTree: FileEntry[] = [
      {
        name: "a",
        path: "/a",
        is_directory: true,
        children: [
          {
            name: "b",
            path: "/a/b",
            is_directory: true,
            children: [
              { name: "c.md", path: "/a/b/c.md", is_directory: false, children: [] },
            ],
          },
        ],
      },
    ];
    const result = flattenVisibleEntries(deepTree, new Set(["/a", "/a/b"]));
    expect(result).toEqual(["/a", "/a/b", "/a/b/c.md"]);
  });

  it("does not include children of collapsed directories", () => {
    const deepTree: FileEntry[] = [
      {
        name: "a",
        path: "/a",
        is_directory: true,
        children: [
          {
            name: "b",
            path: "/a/b",
            is_directory: true,
            children: [
              { name: "c.md", path: "/a/b/c.md", is_directory: false, children: [] },
            ],
          },
        ],
      },
    ];
    // /a is expanded but /a/b is not
    const result = flattenVisibleEntries(deepTree, new Set(["/a"]));
    expect(result).toEqual(["/a", "/a/b"]);
  });
});

describe("findFirstFile", () => {
  it("returns the first non-directory entry", () => {
    const entries: FileEntry[] = [
      { name: "readme.md", path: "/readme.md", is_directory: false, children: [] },
      { name: "notes.md", path: "/notes.md", is_directory: false, children: [] },
    ];
    expect(findFirstFile(entries)).toEqual(entries[0]);
  });

  it("recurses into directories to find files", () => {
    const entries: FileEntry[] = [
      {
        name: "docs",
        path: "/docs",
        is_directory: true,
        children: [
          { name: "plan.md", path: "/docs/plan.md", is_directory: false, children: [] },
        ],
      },
    ];
    expect(findFirstFile(entries)).toEqual(entries[0].children[0]);
  });

  it("returns undefined for an empty tree", () => {
    expect(findFirstFile([])).toBeUndefined();
  });
});

describe("filterEntries", () => {
  const tree: FileEntry[] = [
    {
      name: "guides",
      path: "/guides",
      is_directory: true,
      children: [
        { name: "setup.md", path: "/guides/setup.md", is_directory: false, children: [] },
        { name: "deploy.md", path: "/guides/deploy.md", is_directory: false, children: [] },
      ],
    },
    { name: "readme.md", path: "/readme.md", is_directory: false, children: [] },
    { name: "changelog.md", path: "/changelog.md", is_directory: false, children: [] },
  ];

  it("filters files by partial name match (case-insensitive)", () => {
    const result = filterEntries(tree, "READ");
    expect(result.map((e) => e.name)).toEqual(["readme.md"]);
  });

  it("keeps parent directories of matching files", () => {
    const result = filterEntries(tree, "setup");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("guides");
    expect(result[0].children.length).toBe(1);
    expect(result[0].children[0].name).toBe("setup.md");
  });

  it("returns empty array when nothing matches", () => {
    expect(filterEntries(tree, "zzzzz")).toEqual([]);
  });

  it("returns full tree when query is empty", () => {
    expect(filterEntries(tree, "")).toEqual(tree);
  });

  it("handles nested matches (grandchild files)", () => {
    const deepTree: FileEntry[] = [
      {
        name: "a",
        path: "/a",
        is_directory: true,
        children: [
          {
            name: "b",
            path: "/a/b",
            is_directory: true,
            children: [
              { name: "target.md", path: "/a/b/target.md", is_directory: false, children: [] },
            ],
          },
        ],
      },
    ];
    const result = filterEntries(deepTree, "target");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("a");
    expect(result[0].children[0].name).toBe("b");
    expect(result[0].children[0].children[0].name).toBe("target.md");
  });
});
