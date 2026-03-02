import { describe, it, expect, beforeEach } from "vitest";
import {
  saveLastSelectedPath,
  getLastSelectedPath,
  saveDocsFolder,
  getDocsFolder,
  saveSortMode,
  getSortMode,
  saveLayoutMode,
  getLayoutMode,
  saveOpenPanes,
  getOpenPanes,
  saveExpandedPaths,
  getExpandedPaths,
} from "./persistence";

const STORAGE_KEY = "polar-markdown:last-selected-path";

beforeEach(() => {
  localStorage.clear();
});

describe("saveLastSelectedPath", () => {
  it("saves the path to localStorage", () => {
    saveLastSelectedPath("/docs/readme.md");

    expect(localStorage.getItem(STORAGE_KEY)).toBe("/docs/readme.md");
  });

  it("overwrites a previously saved path", () => {
    saveLastSelectedPath("/docs/old.md");
    saveLastSelectedPath("/docs/new.md");

    expect(localStorage.getItem(STORAGE_KEY)).toBe("/docs/new.md");
  });
});

describe("getLastSelectedPath", () => {
  it("returns null when nothing is stored", () => {
    expect(getLastSelectedPath()).toBeNull();
  });

  it("returns the stored path", () => {
    localStorage.setItem(STORAGE_KEY, "/docs/readme.md");

    expect(getLastSelectedPath()).toBe("/docs/readme.md");
  });
});

const DOCS_FOLDER_KEY = "polar-markdown:docs-folder";

describe("saveDocsFolder", () => {
  it("saves the folder path to localStorage", () => {
    saveDocsFolder("C:\\Users\\test\\my-docs");

    expect(localStorage.getItem(DOCS_FOLDER_KEY)).toBe("C:\\Users\\test\\my-docs");
  });

  it("overwrites a previously saved folder", () => {
    saveDocsFolder("C:\\old-folder");
    saveDocsFolder("C:\\new-folder");

    expect(localStorage.getItem(DOCS_FOLDER_KEY)).toBe("C:\\new-folder");
  });
});

describe("getDocsFolder", () => {
  it("returns null when nothing is stored", () => {
    expect(getDocsFolder()).toBeNull();
  });

  it("returns the stored folder path", () => {
    localStorage.setItem(DOCS_FOLDER_KEY, "C:\\my-docs");

    expect(getDocsFolder()).toBe("C:\\my-docs");
  });
});

const SORT_MODE_KEY = "polar-markdown:sort-mode";

describe("saveSortMode / getSortMode", () => {
  it("round-trips a sort mode value", () => {
    saveSortMode("modified-desc");
    expect(getSortMode()).toBe("modified-desc");
  });

  it("returns 'name-asc' as the default when nothing stored", () => {
    expect(getSortMode()).toBe("name-asc");
  });
});

const LAYOUT_MODE_KEY = "polar-markdown:layout-mode";

describe("saveLayoutMode / getLayoutMode", () => {
  it("round-trips a layout mode value", () => {
    saveLayoutMode("columns");
    expect(getLayoutMode()).toBe("columns");
  });

  it("returns 'centered' as the default when nothing stored", () => {
    expect(getLayoutMode()).toBe("centered");
  });
});

describe("saveOpenPanes / getOpenPanes", () => {
  it("round-trips an array of pane paths", () => {
    saveOpenPanes(["/docs/readme.md", "/docs/plan.md"]);
    expect(getOpenPanes()).toEqual(["/docs/readme.md", "/docs/plan.md"]);
  });

  it("returns empty array when nothing stored", () => {
    expect(getOpenPanes()).toEqual([]);
  });
});

describe("saveExpandedPaths / getExpandedPaths", () => {
  it("round-trips an array of expanded paths", () => {
    saveExpandedPaths(["/docs", "/notes"]);
    expect(getExpandedPaths()).toEqual(["/docs", "/notes"]);
  });

  it("returns empty array when nothing stored", () => {
    expect(getExpandedPaths()).toEqual([]);
  });

  it("overwrites previously saved paths", () => {
    saveExpandedPaths(["/docs"]);
    saveExpandedPaths(["/notes", "/archive"]);
    expect(getExpandedPaths()).toEqual(["/notes", "/archive"]);
  });

  it("returns empty array for corrupt JSON", () => {
    localStorage.setItem("polar-markdown:expanded-paths", "not-json");
    expect(getExpandedPaths()).toEqual([]);
  });
});
