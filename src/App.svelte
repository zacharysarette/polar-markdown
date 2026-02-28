<script lang="ts">
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import MarkdownViewer from "./lib/components/MarkdownViewer.svelte";
  import {
    readDirectoryTree,
    readFileContents,
    startWatching,
    getDocsPath,
    getHelpContent,
    pickFolder,
  } from "./lib/services/filesystem";
  import {
    saveLastSelectedPath,
    getLastSelectedPath,
    saveDocsFolder,
    getDocsFolder,
    saveSortMode,
    getSortMode,
  } from "./lib/services/persistence";
  import { findFirstFile, filterEntries } from "./lib/services/tree-utils";
  import { sortEntries, type SortMode } from "./lib/services/sort";
  import type { FileEntry } from "./lib/types";

  let rawTree: FileEntry[] = $state([]);
  let selectedPath = $state("");
  let fileContent = $state("");
  let docsPath = $state("");
  let sortMode: SortMode = $state(getSortMode());
  let filterQuery = $state("");

  let sortedTree: FileEntry[] = $derived(sortEntries(rawTree, sortMode));
  let tree: FileEntry[] = $derived(filterEntries(sortedTree, filterQuery));

  async function loadTree() {
    if (!docsPath) return;
    try {
      rawTree = await readDirectoryTree(docsPath);
    } catch (e) {
      console.error("Failed to load directory tree:", e);
    }
  }

  async function loadFile(path: string) {
    try {
      fileContent = await readFileContents(path);
      selectedPath = path;
    } catch (e) {
      console.error("Failed to read file:", e);
    }
  }

  function handleSelect(path: string) {
    loadFile(path);
    saveLastSelectedPath(path);
  }

  function findEntryByPath(items: FileEntry[], path: string): FileEntry | undefined {
    for (const item of items) {
      if (item.path === path) return item;
      if (item.is_directory) {
        const found = findEntryByPath(item.children, path);
        if (found) return found;
      }
    }
    return undefined;
  }

  async function switchToFolder(path: string) {
    docsPath = path;
    selectedPath = "";
    fileContent = "";
    await loadTree();

    // Restore last selected file if it exists in the new tree
    const lastPath = getLastSelectedPath();
    if (lastPath && findEntryByPath(sortedTree, lastPath)) {
      await loadFile(lastPath);
    } else {
      const firstFile = findFirstFile(sortedTree);
      if (firstFile) {
        await loadFile(firstFile.path);
        saveLastSelectedPath(firstFile.path);
      }
    }

    // Restart file watcher on the new folder
    try {
      await startWatching(docsPath);
    } catch (e) {
      console.error("Failed to start file watcher:", e);
    }
  }

  const sortModes: SortMode[] = ["name-asc", "name-desc", "modified-desc", "modified-asc"];

  function handleFilterChange(query: string) {
    filterQuery = query;
  }

  function handleSortChange() {
    const currentIndex = sortModes.indexOf(sortMode);
    sortMode = sortModes[(currentIndex + 1) % sortModes.length];
    saveSortMode(sortMode);
  }

  async function handleHelp() {
    try {
      fileContent = await getHelpContent();
      selectedPath = "How to Use Planning Central.md";
    } catch (e) {
      console.error("Failed to load help content:", e);
    }
  }

  async function handleChangeFolder() {
    const selected = await pickFolder();
    if (selected) {
      saveDocsFolder(selected);
      await switchToFolder(selected);
    }
  }

  onMount(() => {
    let unlistenFn: (() => void) | undefined;

    (async () => {
      // Check for a saved folder first, then fall back to Rust backend default
      const savedFolder = getDocsFolder();
      if (savedFolder) {
        docsPath = savedFolder;
      } else {
        try {
          docsPath = await getDocsPath();
        } catch (e) {
          console.error("Failed to get docs path:", e);
          return;
        }
      }

      await loadTree();

      // Restore last selected file, or auto-select the first file
      const lastPath = getLastSelectedPath();
      if (lastPath && findEntryByPath(sortedTree, lastPath)) {
        await loadFile(lastPath);
      } else {
        const firstFile = findFirstFile(sortedTree);
        if (firstFile) {
          await loadFile(firstFile.path);
          saveLastSelectedPath(firstFile.path);
        }
      }

      // Start file watcher
      try {
        await startWatching(docsPath);
      } catch (e) {
        console.error("Failed to start file watcher:", e);
      }

      // Listen for file changes
      unlistenFn = await listen<string[]>("file-changed", async (event) => {
        await loadTree();
        if (selectedPath && event.payload.some((p) => p === selectedPath)) {
          await loadFile(selectedPath);
        }
      });
    })();

    return () => {
      unlistenFn?.();
    };
  });
</script>

<div class="app-layout">
  <Sidebar entries={tree} {selectedPath} onselect={handleSelect} onchangefolder={handleChangeFolder} {sortMode} onsortchange={handleSortChange} onhelp={handleHelp} {filterQuery} onfilterchange={handleFilterChange} />
  <MarkdownViewer content={fileContent} filePath={selectedPath} />
</div>

<style>
  .app-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100%;
    overflow: hidden;
  }
</style>
