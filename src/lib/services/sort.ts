import type { FileEntry } from "../types";

export type SortMode = "name-asc" | "name-desc" | "modified-desc" | "modified-asc";

/**
 * Sorts file entries recursively. Directories always come before files.
 * Returns a new sorted array (does not mutate the original).
 */
export function sortEntries(entries: FileEntry[], mode: SortMode): FileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Directories always first
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;

    switch (mode) {
      case "name-asc":
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      case "name-desc":
        return b.name.toLowerCase().localeCompare(a.name.toLowerCase());
      case "modified-desc":
        return (b.modified ?? 0) - (a.modified ?? 0);
      case "modified-asc":
        return (a.modified ?? 0) - (b.modified ?? 0);
    }
  });

  return sorted.map((entry) =>
    entry.is_directory
      ? { ...entry, children: sortEntries(entry.children, mode) }
      : entry
  );
}
