import { describe, it, expect, beforeEach } from "vitest";
import {
  saveLastSelectedPath,
  getLastSelectedPath,
  saveDocsFolder,
  getDocsFolder,
  saveSortMode,
  getSortMode,
} from "./persistence";

const STORAGE_KEY = "planning-central:last-selected-path";

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

const DOCS_FOLDER_KEY = "planning-central:docs-folder";

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

const SORT_MODE_KEY = "planning-central:sort-mode";

describe("saveSortMode / getSortMode", () => {
  it("round-trips a sort mode value", () => {
    saveSortMode("modified-desc");
    expect(getSortMode()).toBe("modified-desc");
  });

  it("returns 'name-asc' as the default when nothing stored", () => {
    expect(getSortMode()).toBe("name-asc");
  });
});
