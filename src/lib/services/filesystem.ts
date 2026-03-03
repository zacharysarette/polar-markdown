import { invoke } from "@tauri-apps/api/core";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import type { CreateFileResult, FileEntry, MoveFileResult, RenameFileResult, SearchResult } from "../types";

export async function readDirectoryTree(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("read_directory_tree", { path });
}

export async function readFileContents(path: string): Promise<string> {
  return invoke<string>("read_file_contents", { path });
}

export async function startWatching(path: string): Promise<void> {
  return invoke<void>("start_watching", { path });
}

export async function getDocsPath(): Promise<string> {
  return invoke<string>("get_docs_path");
}

export async function getHelpContent(): Promise<string> {
  return invoke<string>("get_help_content");
}

export async function renderAsciiDiagram(input: string, dark: boolean = true): Promise<string> {
  return invoke<string>("render_ascii_diagram", { input, dark });
}

export async function searchFiles(path: string, query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_files", { path, query });
}

export async function writeFileContents(path: string, content: string): Promise<void> {
  return invoke<void>("write_file_contents", { path, content });
}

export async function createFile(directory: string, filename: string): Promise<CreateFileResult> {
  return invoke<CreateFileResult>("create_file", { directory, filename });
}

export async function renameFile(oldPath: string, newName: string): Promise<RenameFileResult> {
  return invoke<RenameFileResult>("rename_file", { oldPath, newName });
}

export async function createDirectory(parent: string, name: string): Promise<string> {
  return invoke<string>("create_directory", { parent, name });
}

export async function moveFile(sourcePath: string, targetDir: string): Promise<MoveFileResult> {
  return invoke<MoveFileResult>("move_file", { sourcePath, targetDir });
}

export async function moveDirectory(sourcePath: string, targetDir: string): Promise<MoveFileResult> {
  return invoke<MoveFileResult>("move_directory", { sourcePath, targetDir });
}

export async function getInitialFile(): Promise<string | null> {
  return invoke<string | null>("get_initial_file");
}

export async function deleteFile(path: string): Promise<void> {
  return invoke<void>("delete_file", { path });
}

export async function deleteDirectory(path: string): Promise<void> {
  return invoke<void>("delete_directory", { path });
}

export async function confirmDelete(filename: string): Promise<boolean> {
  return ask(`Are you sure you want to delete "${filename}"? This cannot be undone.`, {
    title: "Delete File",
    kind: "warning",
  });
}

export async function confirmDeleteFolder(name: string): Promise<boolean> {
  return ask(`Delete folder "${name}" and all its contents? This cannot be undone.`, {
    title: "Delete Folder",
    kind: "warning",
  });
}

export async function saveFileAs(currentPath: string, content: string): Promise<string | null> {
  const sep = currentPath.includes("\\") ? "\\" : "/";
  const filename = currentPath.split(sep).pop() ?? "";
  const newPath = await save({
    defaultPath: filename,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!newPath) return null;
  await writeFileContents(newPath, content);
  return newPath;
}

export async function saveThemeFile(theme: string): Promise<void> {
  await invoke("save_theme", { theme });
}

export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select markdown folder",
  });
  return selected as string | null;
}
