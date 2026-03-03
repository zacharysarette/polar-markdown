import type { SortMode } from "./sort";
import type { LayoutMode, ThemeType } from "../types";
import { saveThemeFile } from "./filesystem";

const STORAGE_KEY = "polar-markdown:last-selected-path";
const DOCS_FOLDER_KEY = "polar-markdown:docs-folder";
const SORT_MODE_KEY = "polar-markdown:sort-mode";
const LAYOUT_MODE_KEY = "polar-markdown:layout-mode";
const OPEN_PANES_KEY = "polar-markdown:open-panes";
const EXPANDED_PATHS_KEY = "polar-markdown:expanded-paths";
const THEME_KEY = "polar-markdown:theme";

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

export function saveExpandedPaths(paths: string[]): void {
  localStorage.setItem(EXPANDED_PATHS_KEY, JSON.stringify(paths));
}

export function getExpandedPaths(): string[] {
  const stored = localStorage.getItem(EXPANDED_PATHS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveTheme(theme: ThemeType): void {
  localStorage.setItem(THEME_KEY, theme);
  saveThemeFile(theme).catch(() => {}); // fire-and-forget, non-blocking
}

export function getTheme(): ThemeType {
  return (localStorage.getItem(THEME_KEY) as ThemeType) || "aurora";
}
