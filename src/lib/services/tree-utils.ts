import type { FileEntry } from "../types";

/**
 * Flattens a tree of FileEntry items into an ordered list of paths,
 * respecting which directories are currently expanded.
 */
export function flattenVisibleEntries(
  entries: FileEntry[],
  expandedPaths: Set<string>
): string[] {
  const result: string[] = [];

  for (const entry of entries) {
    result.push(entry.path);
    if (entry.is_directory && expandedPaths.has(entry.path)) {
      result.push(...flattenVisibleEntries(entry.children, expandedPaths));
    }
  }

  return result;
}

/**
 * Finds the first file (non-directory) in the tree using depth-first traversal.
 * Directories are entered but not returned.
 */
export function findFirstFile(entries: FileEntry[]): FileEntry | undefined {
  for (const entry of entries) {
    if (!entry.is_directory) return entry;
    const found = findFirstFile(entry.children);
    if (found) return found;
  }
  return undefined;
}

/**
 * Filters a tree of FileEntry items by filename (case-insensitive).
 * Keeps directories that contain any matching descendants.
 * Returns the original tree when query is empty.
 */
export function filterEntries(entries: FileEntry[], query: string): FileEntry[] {
  if (!query) return entries;
  const lowerQuery = query.toLowerCase();

  return entries.reduce<FileEntry[]>((result, entry) => {
    if (entry.is_directory) {
      const filteredChildren = filterEntries(entry.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...entry, children: filteredChildren });
      }
    } else if (entry.name.toLowerCase().includes(lowerQuery)) {
      result.push(entry);
    }
    return result;
  }, []);
}
