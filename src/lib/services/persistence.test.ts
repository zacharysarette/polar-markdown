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
  saveTheme,
  getTheme,
  saveRecentFolders,
  getRecentFolders,
  addRecentFolder,
  saveLineNumbers,
  getLineNumbers,
  saveLineWrapping,
  getLineWrapping,
  saveZoomLevel,
  getZoomLevel,
  saveTocVisible,
  getTocVisible,
  saveDocStatsVisible,
  getDocStatsVisible,
} from "./persistence";

const STORAGE_KEY = "glacimark:last-selected-path";

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

const DOCS_FOLDER_KEY = "glacimark:docs-folder";

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

const SORT_MODE_KEY = "glacimark:sort-mode";

describe("saveSortMode / getSortMode", () => {
  it("round-trips a sort mode value", () => {
    saveSortMode("modified-desc");
    expect(getSortMode()).toBe("modified-desc");
  });

  it("returns 'name-asc' as the default when nothing stored", () => {
    expect(getSortMode()).toBe("name-asc");
  });
});

const LAYOUT_MODE_KEY = "glacimark:layout-mode";

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
    localStorage.setItem("glacimark:expanded-paths", "not-json");
    expect(getExpandedPaths()).toEqual([]);
  });
});

describe("saveTheme / getTheme", () => {
  it("round-trips a theme value", () => {
    saveTheme("glacier");
    expect(getTheme()).toBe("glacier");
  });

  it("returns 'aurora' as the default when nothing stored", () => {
    expect(getTheme()).toBe("aurora");
  });

  it("overwrites a previously saved theme", () => {
    saveTheme("glacier");
    saveTheme("aurora");
    expect(getTheme()).toBe("aurora");
  });
});

describe("saveRecentFolders / getRecentFolders", () => {
  it("round-trips an array of folder paths", () => {
    saveRecentFolders(["C:\\docs", "C:\\notes"]);
    expect(getRecentFolders()).toEqual(["C:\\docs", "C:\\notes"]);
  });

  it("returns empty array when nothing stored", () => {
    expect(getRecentFolders()).toEqual([]);
  });

  it("returns empty array for corrupt JSON", () => {
    localStorage.setItem("glacimark:recent-folders", "not-json");
    expect(getRecentFolders()).toEqual([]);
  });
});

describe("addRecentFolder", () => {
  it("adds a new folder to the front", () => {
    const result = addRecentFolder("C:\\docs");
    expect(result).toEqual(["C:\\docs"]);
    expect(getRecentFolders()).toEqual(["C:\\docs"]);
  });

  it("moves an existing folder to the front (deduplicates)", () => {
    saveRecentFolders(["C:\\notes", "C:\\docs", "C:\\archive"]);
    const result = addRecentFolder("C:\\docs");
    expect(result).toEqual(["C:\\docs", "C:\\notes", "C:\\archive"]);
  });

  it("caps at 10 entries", () => {
    const folders = Array.from({ length: 12 }, (_, i) => `C:\\folder${i}`);
    saveRecentFolders(folders);
    const result = addRecentFolder("C:\\new");
    expect(result.length).toBe(10);
    expect(result[0]).toBe("C:\\new");
  });
});

describe("saveLineNumbers / getLineNumbers", () => {
  it("returns false as the default when nothing stored", () => {
    expect(getLineNumbers()).toBe(false);
  });

  it("round-trips true", () => {
    saveLineNumbers(true);
    expect(getLineNumbers()).toBe(true);
  });

  it("round-trips false", () => {
    saveLineNumbers(true);
    saveLineNumbers(false);
    expect(getLineNumbers()).toBe(false);
  });

  it("returns false for corrupted data", () => {
    localStorage.setItem("glacimark:line-numbers", "not-json");
    expect(getLineNumbers()).toBe(false);
  });
});

describe("saveLineWrapping / getLineWrapping", () => {
  it("returns true as the default when nothing stored", () => {
    expect(getLineWrapping()).toBe(true);
  });

  it("round-trips true", () => {
    saveLineWrapping(true);
    expect(getLineWrapping()).toBe(true);
  });

  it("round-trips false", () => {
    saveLineWrapping(false);
    expect(getLineWrapping()).toBe(false);
  });

  it("returns true for corrupted data", () => {
    localStorage.setItem("glacimark:line-wrapping", "not-json");
    expect(getLineWrapping()).toBe(true);
  });
});

describe("saveZoomLevel / getZoomLevel", () => {
  it("returns 1.0 as the default when nothing stored", () => {
    expect(getZoomLevel()).toBe(1.0);
  });

  it("round-trips a valid zoom level", () => {
    saveZoomLevel(1.5);
    expect(getZoomLevel()).toBe(1.5);
  });

  it("returns 1.0 for out-of-range values", () => {
    saveZoomLevel(5.0);
    expect(getZoomLevel()).toBe(1.0);
  });

  it("returns 1.0 for corrupted data", () => {
    localStorage.setItem("glacimark:zoom-level", "not-json");
    expect(getZoomLevel()).toBe(1.0);
  });

  it("accepts boundary values", () => {
    saveZoomLevel(0.5);
    expect(getZoomLevel()).toBe(0.5);
    saveZoomLevel(2.0);
    expect(getZoomLevel()).toBe(2.0);
  });
});

describe("saveTocVisible / getTocVisible", () => {
  it("defaults to false when not stored", () => {
    expect(getTocVisible()).toBe(false);
  });

  it("round-trips true", () => {
    saveTocVisible(true);
    expect(getTocVisible()).toBe(true);
  });

  it("round-trips false", () => {
    saveTocVisible(true);
    saveTocVisible(false);
    expect(getTocVisible()).toBe(false);
  });

  it("returns false for corrupted data", () => {
    localStorage.setItem("glacimark:toc-visible", "not-json");
    expect(getTocVisible()).toBe(false);
  });
});

describe("saveDocStatsVisible / getDocStatsVisible", () => {
  it("defaults to false when not stored", () => {
    expect(getDocStatsVisible()).toBe(false);
  });

  it("round-trips true", () => {
    saveDocStatsVisible(true);
    expect(getDocStatsVisible()).toBe(true);
  });

  it("round-trips false", () => {
    saveDocStatsVisible(true);
    saveDocStatsVisible(false);
    expect(getDocStatsVisible()).toBe(false);
  });

  it("returns false for corrupted data", () => {
    localStorage.setItem("glacimark:doc-stats-visible", "not-json");
    expect(getDocStatsVisible()).toBe(false);
  });
});
