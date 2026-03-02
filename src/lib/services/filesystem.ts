import { invoke } from "@tauri-apps/api/core";
import { ask, open } from "@tauri-apps/plugin-dialog";
import type { CreateFileResult, FileEntry, RenameFileResult, SearchResult } from "../types";

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

export async function renderAsciiDiagram(input: string): Promise<string> {
  return invoke<string>("render_ascii_diagram", { input });
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

export async function getInitialFile(): Promise<string | null> {
  return invoke<string | null>("get_initial_file");
}

export async function deleteFile(path: string): Promise<void> {
  return invoke<void>("delete_file", { path });
}

export async function confirmDelete(filename: string): Promise<boolean> {
  return ask(`Are you sure you want to delete "${filename}"? This cannot be undone.`, {
    title: "Delete File",
    kind: "warning",
  });
}

export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select markdown folder",
  });
  return selected as string | null;
}
