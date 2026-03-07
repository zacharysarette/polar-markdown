import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  ask: vi.fn(),
  save: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { readDirectoryTree, readFileContents, startWatching, getDocsPath, pickFolder, searchFiles, writeFileContents, createFile, renameFile, getInitialFile, deleteFile, deleteDirectory, confirmDelete, confirmDeleteFolder, saveFileAs, moveDirectory, updateJumpList, getInitialFolder, createNewWindow, readDirectoryFiles, restoreDirectoryFiles } from "./filesystem";

const mockOpen = vi.mocked(open);
const mockAsk = vi.mocked(ask);
const mockSave = vi.mocked(save);

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  mockOpen.mockReset();
  mockAsk.mockReset();
  mockSave.mockReset();
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
      'Are you sure you want to delete "notes.md"? File will be moved to the Recycle Bin.',
      { title: "Delete File", kind: "warning" }
    );
    expect(result).toBe(true);
  });
});

describe("saveFileAs", () => {
  it("opens save dialog, writes file, and returns new path", async () => {
    mockSave.mockResolvedValue("C:\\docs\\copy.md");
    mockInvoke.mockResolvedValue(undefined);

    const result = await saveFileAs("C:\\docs\\original.md", "# Hello");

    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "original.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(mockInvoke).toHaveBeenCalledWith("write_file_contents", {
      path: "C:\\docs\\copy.md",
      content: "# Hello",
    });
    expect(result).toBe("C:\\docs\\copy.md");
  });

  it("returns null when user cancels the dialog", async () => {
    mockSave.mockResolvedValue(null);

    const result = await saveFileAs("C:\\docs\\original.md", "# Hello");

    expect(result).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("moveDirectory", () => {
  it("calls invoke with correct command and args", async () => {
    const mockResult = { old_path: "/docs/source", new_path: "/docs/target/source" };
    mockInvoke.mockResolvedValue(mockResult);

    const result = await moveDirectory("/docs/source", "/docs/target");

    expect(mockInvoke).toHaveBeenCalledWith("move_directory", {
      sourcePath: "/docs/source",
      targetDir: "/docs/target",
    });
    expect(result).toEqual(mockResult);
  });

  it("propagates errors from invoke", async () => {
    mockInvoke.mockRejectedValue(new Error("Cannot move a directory into itself"));

    await expect(moveDirectory("/docs/parent", "/docs/parent/child")).rejects.toThrow("Cannot move a directory into itself");
  });
});

describe("deleteDirectory", () => {
  it("calls invoke with correct command and path", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await deleteDirectory("/docs/old-folder");

    expect(mockInvoke).toHaveBeenCalledWith("delete_directory", {
      path: "/docs/old-folder",
    });
  });

  it("propagates errors from invoke", async () => {
    mockInvoke.mockRejectedValue(new Error("Directory does not exist"));

    await expect(deleteDirectory("/docs/missing")).rejects.toThrow("Directory does not exist");
  });
});

describe("createNewWindow", () => {
  it("calls invoke with correct command", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await createNewWindow();

    expect(mockInvoke).toHaveBeenCalledWith("create_new_window");
  });
});

describe("confirmDeleteFolder", () => {
  it("calls ask with folder-specific message and options", async () => {
    mockAsk.mockResolvedValue(true);

    const result = await confirmDeleteFolder("my-notes");

    expect(mockAsk).toHaveBeenCalledWith(
      'Delete folder "my-notes" and all its contents? Files will be moved to the Recycle Bin.',
      { title: "Delete Folder", kind: "warning" }
    );
    expect(result).toBe(true);
  });

  it("returns false when user cancels", async () => {
    mockAsk.mockResolvedValue(false);

    const result = await confirmDeleteFolder("my-notes");

    expect(result).toBe(false);
  });
});

describe("updateJumpList", () => {
  it("calls invoke with correct command and folder list", async () => {
    mockInvoke.mockResolvedValue(undefined);

    await updateJumpList(["C:\\docs", "C:\\notes"]);

    expect(mockInvoke).toHaveBeenCalledWith("update_jump_list", {
      folders: ["C:\\docs", "C:\\notes"],
    });
  });
});

describe("getInitialFolder", () => {
  it("calls invoke with correct command", async () => {
    mockInvoke.mockResolvedValue("C:\\docs");

    const result = await getInitialFolder();

    expect(mockInvoke).toHaveBeenCalledWith("get_initial_folder");
    expect(result).toBe("C:\\docs");
  });

  it("returns null when no folder was passed", async () => {
    mockInvoke.mockResolvedValue(null);

    const result = await getInitialFolder();

    expect(result).toBeNull();
  });
});

describe("readDirectoryFiles", () => {
  it("calls invoke with correct command and path", async () => {
    const mockFiles = [
      { relative_path: "readme.md", content: "# README" },
      { relative_path: "sub/note.md", content: "# Note" },
    ];
    mockInvoke.mockResolvedValue(mockFiles);

    const result = await readDirectoryFiles("/docs/folder");

    expect(mockInvoke).toHaveBeenCalledWith("read_directory_files", { path: "/docs/folder" });
    expect(result).toEqual(mockFiles);
  });
});

describe("restoreDirectoryFiles", () => {
  it("calls invoke with correct command, basePath, and files", async () => {
    mockInvoke.mockResolvedValue(undefined);

    const files = [
      { relative_path: "readme.md", content: "# README" },
    ];
    await restoreDirectoryFiles("/docs/folder", files);

    expect(mockInvoke).toHaveBeenCalledWith("restore_directory_files", {
      basePath: "/docs/folder",
      files,
    });
  });
});

describe("confirmDelete updated message", () => {
  it("mentions Recycle Bin instead of 'cannot be undone'", async () => {
    mockAsk.mockResolvedValue(true);

    await confirmDelete("test.md");

    expect(mockAsk).toHaveBeenCalledWith(
      expect.stringContaining("Recycle Bin"),
      expect.any(Object),
    );
  });
});

describe("confirmDeleteFolder updated message", () => {
  it("mentions Recycle Bin instead of 'cannot be undone'", async () => {
    mockAsk.mockResolvedValue(true);

    await confirmDeleteFolder("myfolder");

    expect(mockAsk).toHaveBeenCalledWith(
      expect.stringContaining("Recycle Bin"),
      expect.any(Object),
    );
  });
});
