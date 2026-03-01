import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileEntry, SearchResult } from "../types";

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

export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select markdown folder",
  });
  return selected as string | null;
}
