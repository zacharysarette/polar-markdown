import type { SortMode } from "./sort";

const STORAGE_KEY = "planning-central:last-selected-path";
const DOCS_FOLDER_KEY = "planning-central:docs-folder";
const SORT_MODE_KEY = "planning-central:sort-mode";

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
