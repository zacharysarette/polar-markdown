import type { SortMode } from "./sort";
import type { LayoutMode, ThemeType } from "../types";
import { saveThemeFile } from "./filesystem";

const STORAGE_KEY = "glacimark:last-selected-path";
const DOCS_FOLDER_KEY = "glacimark:docs-folder";
const SORT_MODE_KEY = "glacimark:sort-mode";
const LAYOUT_MODE_KEY = "glacimark:layout-mode";
const OPEN_PANES_KEY = "glacimark:open-panes";
const EXPANDED_PATHS_KEY = "glacimark:expanded-paths";
const RECENT_FOLDERS_KEY = "glacimark:recent-folders";
const THEME_KEY = "glacimark:theme";
const LINE_NUMBERS_KEY = "glacimark:line-numbers";
const LINE_WRAPPING_KEY = "glacimark:line-wrapping";
const ZOOM_LEVEL_KEY = "glacimark:zoom-level";
const TOC_VISIBLE_KEY = "glacimark:toc-visible";
const DOC_STATS_VISIBLE_KEY = "glacimark:doc-stats-visible";

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

export function saveRecentFolders(folders: string[]): void {
  localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(folders));
}

export function getRecentFolders(): string[] {
  const stored = localStorage.getItem(RECENT_FOLDERS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addRecentFolder(folder: string): string[] {
  const existing = getRecentFolders();
  const filtered = existing.filter((f) => f !== folder);
  const updated = [folder, ...filtered].slice(0, 10);
  saveRecentFolders(updated);
  return updated;
}

export function saveTheme(theme: ThemeType): void {
  localStorage.setItem(THEME_KEY, theme);
  saveThemeFile(theme).catch(() => {}); // fire-and-forget, non-blocking
}

export function getTheme(): ThemeType {
  return (localStorage.getItem(THEME_KEY) as ThemeType) || "aurora";
}

export function saveLineNumbers(enabled: boolean): void {
  localStorage.setItem(LINE_NUMBERS_KEY, JSON.stringify(enabled));
}

export function getLineNumbers(): boolean {
  const stored = localStorage.getItem(LINE_NUMBERS_KEY);
  if (!stored) return false;
  try {
    return JSON.parse(stored) === true;
  } catch {
    return false;
  }
}

export function saveLineWrapping(enabled: boolean): void {
  localStorage.setItem(LINE_WRAPPING_KEY, JSON.stringify(enabled));
}

export function getLineWrapping(): boolean {
  const stored = localStorage.getItem(LINE_WRAPPING_KEY);
  if (!stored) return true;
  try {
    return JSON.parse(stored) === true;
  } catch {
    return true;
  }
}

export function saveZoomLevel(level: number): void {
  localStorage.setItem(ZOOM_LEVEL_KEY, JSON.stringify(level));
}

export function getZoomLevel(): number {
  const stored = localStorage.getItem(ZOOM_LEVEL_KEY);
  if (!stored) return 1.0;
  try {
    const val = JSON.parse(stored);
    if (typeof val === "number" && val >= 0.5 && val <= 2.0) return val;
    return 1.0;
  } catch {
    return 1.0;
  }
}

export function saveTocVisible(visible: boolean): void {
  localStorage.setItem(TOC_VISIBLE_KEY, JSON.stringify(visible));
}

export function getTocVisible(): boolean {
  const stored = localStorage.getItem(TOC_VISIBLE_KEY);
  if (!stored) return false;
  try {
    return JSON.parse(stored) === true;
  } catch {
    return false;
  }
}

export function saveDocStatsVisible(visible: boolean): void {
  localStorage.setItem(DOC_STATS_VISIBLE_KEY, JSON.stringify(visible));
}

export function getDocStatsVisible(): boolean {
  const stored = localStorage.getItem(DOC_STATS_VISIBLE_KEY);
  if (!stored) return false;
  try {
    return JSON.parse(stored) === true;
  } catch {
    return false;
  }
}
