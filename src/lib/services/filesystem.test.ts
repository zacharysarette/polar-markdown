import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readDirectoryTree, readFileContents, startWatching, getDocsPath, pickFolder, searchFiles, writeFileContents } from "./filesystem";

const mockOpen = vi.mocked(open);

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  mockOpen.mockReset();
});

describe("readDirectoryTree", () => {
  it("calls invoke with correct command and path", async () => {
    const mockTree = [
      { name: "docs", path: "/docs", is_directory: true, children: [] },
    ];
    mockInvoke.mockResolvedValue(mockTree);

    const result = await readDirectoryTree("/project");

    expect(mockInvoke).toHaveBeenCalledWith("read_directory_tree", {
      path: "/project",
    });
    expect(result).toEqual(mockTree);
  });

  it("propagates errors from invoke", async () => {
    mockInvoke.mockRejectedValue(new Error("Directory not found"));

    await expect(readDirectoryTree("/bad")).rejects.toThrow("Directory not found");
  });
});

describe("readFileContents", () => {
  it("calls invoke with correct command and path", async () => {
    mockInvoke.mockResolvedValue("# Hello");

    const result = await readFileContents("/docs/test.md");

    expect(mockInvoke).toHaveBeenCalledWith("read_file_contents", {
      path: "/docs/test.md",
    });
    expect(result).toBe("# Hello");
  });
});

describe("startWatching", () => {
  it("calls invoke with correct command and path", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await startWatching("/docs");

    expect(mockInvoke).toHaveBeenCalledWith("start_watching", {
      path: "/docs",
    });
  });
});

describe("getDocsPath", () => {
  it("calls invoke with correct command", async () => {
    mockInvoke.mockResolvedValue("C:\\project\\docs");

    const result = await getDocsPath();

    expect(mockInvoke).toHaveBeenCalledWith("get_docs_path");
    expect(result).toBe("C:\\project\\docs");
  });
});

describe("pickFolder", () => {
  it("opens a directory picker dialog and returns the selected path", async () => {
    mockOpen.mockResolvedValue("C:\\Users\\test\\my-docs");

    const result = await pickFolder();

    expect(mockOpen).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Select markdown folder",
    });
    expect(result).toBe("C:\\Users\\test\\my-docs");
  });

  it("returns null when user cancels the dialog", async () => {
    mockOpen.mockResolvedValue(null);

    const result = await pickFolder();

    expect(result).toBeNull();
  });
});

describe("searchFiles", () => {
  it("calls invoke with correct command and args", async () => {
    const mockResults = [
      { path: "/docs/readme.md", name: "readme.md", matches: [{ line_number: 1, line_content: "# README" }] },
    ];
    mockInvoke.mockResolvedValue(mockResults);

    const result = await searchFiles("/docs", "README");

    expect(mockInvoke).toHaveBeenCalledWith("search_files", { path: "/docs", query: "README" });
    expect(result).toEqual(mockResults);
  });
});

describe("writeFileContents", () => {
  it("calls invoke with correct command, path and content", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await writeFileContents("/docs/test.md", "# Hello World");

    expect(mockInvoke).toHaveBeenCalledWith("write_file_contents", {
      path: "/docs/test.md",
      content: "# Hello World",
    });
  });
});
