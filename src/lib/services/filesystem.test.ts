import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  ask: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { readDirectoryTree, readFileContents, startWatching, getDocsPath, pickFolder, searchFiles, writeFileContents, createFile, renameFile, getInitialFile, deleteFile, confirmDelete } from "./filesystem";

const mockOpen = vi.mocked(open);
const mockAsk = vi.mocked(ask);

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  mockOpen.mockReset();
  mockAsk.mockReset();
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

describe("createFile", () => {
  it("calls invoke with correct command, directory and filename", async () => {
    const mockResult = { path: "/docs/new-note.md", content: "# New Note\n\n" };
    mockInvoke.mockResolvedValue(mockResult);

    const result = await createFile("/docs", "new-note.md");

    expect(mockInvoke).toHaveBeenCalledWith("create_file", {
      directory: "/docs",
      filename: "new-note.md",
    });
    expect(result).toEqual(mockResult);
  });

  it("propagates errors from invoke", async () => {
    mockInvoke.mockRejectedValue(new Error("File already exists"));

    await expect(createFile("/docs", "existing.md")).rejects.toThrow("File already exists");
  });
});

describe("getInitialFile", () => {
  it("calls invoke with correct command", async () => {
    mockInvoke.mockResolvedValue("C:\\docs\\readme.md");

    const result = await getInitialFile();

    expect(mockInvoke).toHaveBeenCalledWith("get_initial_file");
    expect(result).toBe("C:\\docs\\readme.md");
  });

  it("returns null when no file was passed", async () => {
    mockInvoke.mockResolvedValue(null);

    const result = await getInitialFile();

    expect(result).toBeNull();
  });
});

describe("renameFile", () => {
  it("calls invoke with correct command, oldPath and newName", async () => {
    const mockResult = { old_path: "/docs/old.md", new_path: "/docs/new.md" };
    mockInvoke.mockResolvedValue(mockResult);

    const result = await renameFile("/docs/old.md", "new.md");

    expect(mockInvoke).toHaveBeenCalledWith("rename_file", {
      oldPath: "/docs/old.md",
      newName: "new.md",
    });
    expect(result).toEqual(mockResult);
  });

  it("propagates errors from invoke", async () => {
    mockInvoke.mockRejectedValue(new Error("Source file does not exist"));

    await expect(renameFile("/docs/missing.md", "new.md")).rejects.toThrow("Source file does not exist");
  });
});

describe("deleteFile", () => {
  it("calls invoke with correct command and path", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await deleteFile("/docs/old-note.md");

    expect(mockInvoke).toHaveBeenCalledWith("delete_file", {
      path: "/docs/old-note.md",
    });
  });

  it("propagates errors from invoke", async () => {
    mockInvoke.mockRejectedValue(new Error("File does not exist"));

    await expect(deleteFile("/docs/missing.md")).rejects.toThrow("File does not exist");
  });
});

describe("confirmDelete", () => {
  it("calls ask with correct message and options", async () => {
    mockAsk.mockResolvedValue(true);

    const result = await confirmDelete("notes.md");

    expect(mockAsk).toHaveBeenCalledWith(
      'Are you sure you want to delete "notes.md"? This cannot be undone.',
      { title: "Delete File", kind: "warning" }
    );
    expect(result).toBe(true);
  });
});
