import type { SortMode } from "./sort";
import type { LayoutMode } from "../types";

const STORAGE_KEY = "planning-central:last-selected-path";
const DOCS_FOLDER_KEY = "planning-central:docs-folder";
const SORT_MODE_KEY = "planning-central:sort-mode";
const LAYOUT_MODE_KEY = "planning-central:layout-mode";
const OPEN_PANES_KEY = "planning-central:open-panes";

export function saveLastSelectedPath(path: string): void {
  localStorage.setItem(STORAGE_KEY, path);
}

export function getLastSelectedPath(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function saveDocsFolder(path: string): void {
  localStorage.setItem(DOCS_FOLDER_KEY, path);
}

export function getDocsFolder(): string | null {
  return localStorage.getItem(DOCS_FOLDER_KEY);
}

export function saveSortMode(mode: SortMode): void {
  localStorage.setItem(SORT_MODE_KEY, mode);
}

export function getSortMode(): SortMode {
  return (localStorage.getItem(SORT_MODE_KEY) as SortMode) || "name-asc";
}

export function saveLayoutMode(mode: LayoutMode): void {
  localStorage.setItem(LAYOUT_MODE_KEY, mode);
}

export function getLayoutMode(): LayoutMode {
  return (localStorage.getItem(LAYOUT_MODE_KEY) as LayoutMode) || "centered";
}

export function saveOpenPanes(paths: string[]): void {
  localStorage.setItem(OPEN_PANES_KEY, JSON.stringify(paths));
}

export function getOpenPanes(): string[] {
  const stored = localStorage.getItem(OPEN_PANES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}
