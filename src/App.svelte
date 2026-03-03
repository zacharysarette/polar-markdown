<script lang="ts">
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import ContentArea from "./lib/components/ContentArea.svelte";
  import {
    readDirectoryTree,
    readFileContents,
    writeFileContents,
    startWatching,
    getDocsPath,
    getHelpContent,
    pickFolder,
    searchFiles,
    createFile,
    createDirectory,
    renameFile,
    deleteFile,
    deleteDirectory,
    confirmDelete,
    confirmDeleteFolder,
    getInitialFile,
    saveFileAs,
    moveFile,
    moveDirectory,
    saveThemeFile,
  } from "./lib/services/filesystem";
  import {
    saveLastSelectedPath,
    getLastSelectedPath,
    saveDocsFolder,
    getDocsFolder,
    saveSortMode,
    getSortMode,
    saveLayoutMode,
    getLayoutMode,
    saveOpenPanes,
    getOpenPanes,
    saveTheme,
    getTheme,
  } from "./lib/services/persistence";
  import { setMermaidTheme, setBobDarkMode } from "./lib/services/markdown";
  import { findFirstFile, filterEntries } from "./lib/services/tree-utils";
  import { sortEntries, type SortMode } from "./lib/services/sort";
  import { resetDragSource } from "./lib/components/FileTreeItem.svelte";
  import type { FileEntry, LayoutMode, OpenPane, SearchResult, ThemeType } from "./lib/types";

  const MAX_PANES = 4;
  let nextPaneId = 1;

  function dismissSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    setTimeout(() => splash.remove(), 1000);
  }

  let theme: ThemeType = $state(getTheme());
  let rawTree: FileEntry[] = $state([]);
  let panes: OpenPane[] = $state([]);
  let activePaneId = $state("");
  let docsPath = $state("");
  let sortMode: SortMode = $state(getSortMode());
  let layoutMode: LayoutMode = $state(getLayoutMode());
  let filterQuery = $state("");
  let searchMode = $state(false);
  let searchQuery = $state("");
  let searchResults: SearchResult[] = $state([]);
  let isSearching = $state(false);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  let highlightText = $state("");
  let highlightKey = $state(0);
  let creatingFile = $state(false);
  let newFileError = $state("");
  let creatingFolder = $state(false);
  let newFolderError = $state("");
  let selectedFolderPath = $state("");
  let focusedTreePath = $state("");
  let renamingPath = $state("");
  let renameError = $state("");
  const recentOwnWrites = new Set<string>();
  let suppressWatcherUntil = 0;
  let savedPaneBeforeHelp: { path: string; content: string; editMode?: boolean } | null = null;

  // Apply theme to DOM and diagram renderers
  $effect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    setMermaidTheme(theme);
    setBobDarkMode(theme === "aurora");
  });

  function handleThemeToggle() {
    theme = theme === "aurora" ? "glacier" : "aurora";
    saveTheme(theme);
  }

  let sortedTree: FileEntry[] = $derived(sortEntries(rawTree, sortMode));
  let tree: FileEntry[] = $derived(filterEntries(sortedTree, filterQuery));

  // The "selected" path for sidebar highlighting is the active pane's path
  let selectedPath: string = $derived(
    panes.find((p) => p.id === activePaneId)?.path ?? ""
  );
  let helpActive: boolean = $derived(
    panes.find((p) => p.id === activePaneId)?.readOnly === true
  );

  async function loadTree() {
    if (!docsPath) return;
    try {
      rawTree = await readDirectoryTree(docsPath);
    } catch (e) {
      console.error("Failed to load directory tree:", e);
    }
  }

  function createPaneId(): string {
    return String(nextPaneId++);
  }

  async function openInActivePane(path: string, editMode = false, initialContent?: string) {
    try {
      const content = initialContent ?? await readFileContents(path);
      if (panes.length === 0) {
        const id = createPaneId();
        panes = [{ id, path, content, editMode }];
        activePaneId = id;
      } else {
        panes = panes.map((p) =>
          p.id === activePaneId ? { ...p, path, content, readOnly: false, editMode } : p
        );
      }
      saveLastSelectedPath(path);
      persistPanes();
    } catch (e) {
      console.error("Failed to read file:", e);
    }
  }

  async function openInNewPane(path: string) {
    if (panes.length >= MAX_PANES) return;
    try {
      const content = await readFileContents(path);
      const id = createPaneId();
      panes = [...panes, { id, path, content }];
      activePaneId = id;
      saveLastSelectedPath(path);
      persistPanes();
    } catch (e) {
      console.error("Failed to read file:", e);
    }
  }

  function persistPanes() {
    saveOpenPanes(panes.map((p) => p.path));
  }

  function handleSelect(path: string, event?: MouseEvent, lineContent?: string) {
    highlightText = lineContent ?? "";
    if (lineContent) highlightKey++;
    selectedFolderPath = "";
    if (event?.ctrlKey && panes.length < MAX_PANES) {
      openInNewPane(path);
    } else {
      openInActivePane(path);
    }
  }

  function handleClosePane(id: string) {
    panes = panes.filter((p) => p.id !== id);
    if (activePaneId === id) {
      activePaneId = panes.length > 0 ? panes[panes.length - 1].id : "";
    }
    persistPanes();
  }

  function handleActivatePane(id: string) {
    activePaneId = id;
    const pane = panes.find((p) => p.id === id);
    if (pane) saveLastSelectedPath(pane.path);
  }

  async function handleToggleEdit(id: string) {
    const pane = panes.find((p) => p.id === id);
    if (!pane || pane.readOnly) return;

    if (pane.editMode) {
      // Switching from edit → view: reload from disk to show latest
      try {
        const content = await readFileContents(pane.path);
        panes = panes.map((p) =>
          p.id === id ? { ...p, editMode: false, content } : p
        );
      } catch {
        panes = panes.map((p) =>
          p.id === id ? { ...p, editMode: false } : p
        );
      }
    } else {
      // Switching from view → edit
      panes = panes.map((p) =>
        p.id === id ? { ...p, editMode: true } : p
      );
    }
  }

  async function handleSave(path: string, content: string) {
    try {
      recentOwnWrites.add(path);
      await writeFileContents(path, content);
      // Update pane content to reflect saved state
      panes = panes.map((p) =>
        p.path === path ? { ...p, content } : p
      );
      setTimeout(() => recentOwnWrites.delete(path), 500);
    } catch (e) {
      console.error("Failed to save file:", e);
      recentOwnWrites.delete(path);
    }
  }

  async function handleSaveAs() {
    const pane = panes.find((p) => p.id === activePaneId);
    if (!pane || pane.readOnly) return;

    const newPath = await saveFileAs(pane.path, pane.content);
    if (!newPath) return;

    recentOwnWrites.add(newPath);
    panes = panes.map((p) =>
      p.id === activePaneId ? { ...p, path: newPath } : p
    );
    persistPanes();
    saveLastSelectedPath(newPath);
    loadTree();
    setTimeout(() => recentOwnWrites.delete(newPath), 500);
  }

  async function handleSaveAsForPath(path: string) {
    try {
      const content = await readFileContents(path);
      const newPath = await saveFileAs(path, content);
      if (!newPath) return;

      recentOwnWrites.add(newPath);
      // Update any open pane showing the original file
      panes = panes.map((p) =>
        p.path === path ? { ...p, path: newPath } : p
      );
      persistPanes();
      loadTree();
      setTimeout(() => recentOwnWrites.delete(newPath), 500);
    } catch (e) {
      console.error("Failed to save file as:", e);
    }
  }

  async function handleSaveAsFromPane(id: string) {
    const pane = panes.find((p) => p.id === id);
    if (!pane || pane.readOnly) return;

    const newPath = await saveFileAs(pane.path, pane.content);
    if (!newPath) return;

    recentOwnWrites.add(newPath);
    panes = panes.map((p) =>
      p.id === id ? { ...p, path: newPath } : p
    );
    persistPanes();
    saveLastSelectedPath(newPath);
    loadTree();
    setTimeout(() => recentOwnWrites.delete(newPath), 500);
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
    panes = [];
    activePaneId = "";
    await loadTree();

    // Restore last selected file if it exists in the new tree
    const lastPath = getLastSelectedPath();
    if (lastPath && findEntryByPath(sortedTree, lastPath)) {
      await openInActivePane(lastPath);
    } else {
      const firstFile = findFirstFile(sortedTree);
      if (firstFile) {
        await openInActivePane(firstFile.path);
      }
    }

    // Restart file watcher on the new folder
    try {
      await startWatching(docsPath);
    } catch (e) {
      console.error("Failed to start file watcher:", e);
    }
  }

  async function openFileFromOS(filePath: string) {
    // Extract parent directory from the file path
    const sep = filePath.includes("\\") ? "\\" : "/";
    const parts = filePath.split(sep);
    parts.pop();
    const parentDir = parts.join(sep);

    // Set docs path to the parent directory
    docsPath = parentDir;
    saveDocsFolder(parentDir);
    await loadTree();

    // Open the file in the active pane
    await openInActivePane(filePath);

    // Start watcher on the new directory
    try {
      await startWatching(parentDir);
    } catch (e) {
      console.error("Failed to start file watcher:", e);
    }
  }

  const sortModes: SortMode[] = ["name-asc", "name-desc", "modified-desc", "modified-asc"];

  function handleFilterChange(query: string) {
    filterQuery = query;
  }

  function handleSearchModeChange() {
    searchMode = !searchMode;
    if (!searchMode) {
      searchQuery = "";
      searchResults = [];
      isSearching = false;
    }
  }

  function handleSearchChange(query: string) {
    searchQuery = query;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    if (!query.trim()) {
      searchResults = [];
      isSearching = false;
      return;
    }

    isSearching = true;
    searchDebounceTimer = setTimeout(async () => {
      if (!docsPath || !searchQuery.trim()) return;
      try {
        searchResults = await searchFiles(docsPath, searchQuery);
      } catch (e) {
        console.error("Search failed:", e);
        searchResults = [];
      }
      isSearching = false;
    }, 300);
  }

  function handleSortChange() {
    const currentIndex = sortModes.indexOf(sortMode);
    sortMode = sortModes[(currentIndex + 1) % sortModes.length];
    saveSortMode(sortMode);
  }

  function handleLayoutChange(mode: LayoutMode) {
    layoutMode = mode;
    saveLayoutMode(mode);
  }

  async function handleHelp() {
    // If already viewing help, restore the previous pane state
    if (helpActive && savedPaneBeforeHelp) {
      try {
        const saved = savedPaneBeforeHelp;
        const content = await readFileContents(saved.path);
        panes = panes.map((p) =>
          p.id === activePaneId
            ? { ...p, path: saved.path, content, readOnly: false, editMode: saved.editMode }
            : p
        );
        saveLastSelectedPath(saved.path);
        savedPaneBeforeHelp = null;
      } catch (e) {
        console.error("Failed to restore previous file:", e);
        savedPaneBeforeHelp = null;
      }
      return;
    }

    try {
      // Save current pane state before opening help
      const activePane = panes.find((p) => p.id === activePaneId);
      if (activePane && !activePane.readOnly) {
        savedPaneBeforeHelp = { path: activePane.path, content: activePane.content, editMode: activePane.editMode };
      }

      const content = await getHelpContent();
      if (panes.length === 0) {
        const id = createPaneId();
        panes = [{ id, path: "How to Use Polar Markdown.md", content, readOnly: true, editMode: false }];
        activePaneId = id;
        savedPaneBeforeHelp = null;
      } else {
        panes = panes.map((p) =>
          p.id === activePaneId
            ? { ...p, path: "How to Use Polar Markdown.md", content, readOnly: true, editMode: false }
            : p
        );
      }
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

  function handleNewFile() {
    creatingFile = true;
    newFileError = "";
  }

  function handleCancelCreate() {
    creatingFile = false;
    newFileError = "";
  }

  function getTargetDir(): string {
    if (selectedFolderPath) return selectedFolderPath;
    if (focusedTreePath) {
      const entry = findEntryByPath(rawTree, focusedTreePath);
      if (entry?.is_directory) return focusedTreePath;
    }
    return docsPath;
  }

  async function handleCreateNewFile(filename: string) {
    let targetDir = getTargetDir();

    try {
      const { path: newPath, content } = await createFile(targetDir, filename);
      creatingFile = false;
      newFileError = "";
      openInActivePane(newPath, true, content);
      loadTree();
    } catch (e: any) {
      newFileError = typeof e === "string" ? e : e?.message || String(e);
    }
  }

  function handleFocusChange(path: string) {
    focusedTreePath = path;
  }

  function handleFolderSelect(path: string) {
    selectedFolderPath = path;
  }

  function handleNewFolder() {
    creatingFolder = true;
    newFolderError = "";
  }

  function handleCancelCreateFolder() {
    creatingFolder = false;
    newFolderError = "";
  }

  async function handleCreateNewFolder(name: string) {
    let targetDir = getTargetDir();

    try {
      const newPath = await createDirectory(targetDir, name);
      creatingFolder = false;
      newFolderError = "";
      selectedFolderPath = newPath;
      await loadTree();
    } catch (e: any) {
      newFolderError = typeof e === "string" ? e : e?.message || String(e);
    }
  }

  async function handleMoveFile(sourcePath: string, targetDir: string) {
    try {
      // Suppress watcher reloads — move triggers Remove/Create/Modify events
      // for old path, new path, and parent dirs that would cause extra reloads
      suppressWatcherUntil = Date.now() + 2000;

      const entry = findEntryByPath(rawTree, sourcePath);
      const isDir = entry?.is_directory ?? false;

      const { old_path, new_path } = isDir
        ? await moveDirectory(sourcePath, targetDir)
        : await moveFile(sourcePath, targetDir);

      recentOwnWrites.add(old_path);
      recentOwnWrites.add(new_path);

      if (isDir) {
        const sep = old_path.includes("\\") ? "\\" : "/";
        const oldPrefix = old_path + sep;
        const newPrefix = new_path + sep;
        panes = panes.map(p => {
          if (p.path.startsWith(oldPrefix)) {
            return { ...p, path: newPrefix + p.path.slice(oldPrefix.length) };
          }
          return p;
        });
        if (selectedFolderPath === old_path || selectedFolderPath.startsWith(oldPrefix)) {
          selectedFolderPath = selectedFolderPath === old_path ? new_path : newPrefix + selectedFolderPath.slice(oldPrefix.length);
        }
      } else {
        panes = panes.map(p =>
          p.path === old_path ? { ...p, path: new_path } : p
        );
      }
      persistPanes();

      await loadTree();

      setTimeout(() => {
        recentOwnWrites.delete(old_path);
        recentOwnWrites.delete(new_path);
      }, 2000);
    } catch (e: any) {
      console.error("Move failed:", e);
      const msg = typeof e === "string" ? e : e?.message || String(e);
      alert("Move failed: " + msg);
    }
  }

  function handleStartRename(path: string) {
    renamingPath = path;
    renameError = "";
  }

  function handleCancelRename() {
    renamingPath = "";
    renameError = "";
  }

  async function handleConfirmRename(oldPath: string, newName: string) {
    try {
      const { new_path: newPath } = await renameFile(oldPath, newName);

      // Clear rename UI
      renamingPath = "";
      renameError = "";

      // No-op if same name
      if (oldPath === newPath) return;

      // Add newPath to recentOwnWrites to prevent watcher re-read
      recentOwnWrites.add(newPath);
      setTimeout(() => recentOwnWrites.delete(newPath), 500);

      // Update all pane paths: oldPath → newPath
      panes = panes.map((p) =>
        p.path === oldPath ? { ...p, path: newPath } : p
      );
      persistPanes();

      // Update last selected path if it was the renamed file
      if (selectedPath === newPath) {
        saveLastSelectedPath(newPath);
      }

      // Update focusedTreePath if it was the renamed file
      if (focusedTreePath === oldPath) {
        focusedTreePath = newPath;
      }

      // Refresh tree in background
      loadTree();
    } catch (e: any) {
      renameError = typeof e === "string" ? e : e?.message || String(e);
    }
  }

  async function handleDeleteFile(path: string) {
    // Extract name from path
    const sep = path.includes("\\") ? "\\" : "/";
    const parts = path.split(sep);
    const name = parts[parts.length - 1];

    // Determine if this is a directory
    const entry = findEntryByPath(rawTree, path);
    const isDir = entry?.is_directory ?? false;

    // Confirm with user via native dialog
    const confirmed = isDir
      ? await confirmDeleteFolder(name)
      : await confirmDelete(name);
    if (!confirmed) return;

    try {
      // Prevent watcher double-refresh
      recentOwnWrites.add(path);

      if (isDir) {
        await deleteDirectory(path);

        // Close all panes whose path starts with the deleted directory
        const dirPrefix = path.endsWith(sep) ? path : path + sep;
        const wasActive = panes.find((p) => p.id === activePaneId);
        panes = panes.filter((p) => p.path !== path && !p.path.startsWith(dirPrefix));
        if (wasActive && !panes.find((p) => p.id === wasActive.id)) {
          activePaneId = panes.length > 0 ? panes[panes.length - 1].id : "";
        }

        // Clear selectedFolderPath if it was the deleted dir
        if (selectedFolderPath === path || selectedFolderPath.startsWith(dirPrefix)) {
          selectedFolderPath = "";
        }
      } else {
        await deleteFile(path);

        // Close any panes showing this file
        const wasActive = panes.find((p) => p.id === activePaneId)?.path === path;
        panes = panes.filter((p) => p.path !== path);
        if (wasActive) {
          activePaneId = panes.length > 0 ? panes[panes.length - 1].id : "";
        }
      }

      persistPanes();

      // Refresh tree
      await loadTree();

      // Clear focused path if it was the deleted item
      if (focusedTreePath === path) {
        focusedTreePath = "";
      }

      setTimeout(() => recentOwnWrites.delete(path), 500);
    } catch (e) {
      console.error("Failed to delete:", e);
      recentOwnWrites.delete(path);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Escape: reset drag state (mitigates Windows 11 WebView2 stuck-drag bug)
    if (event.key === "Escape") {
      resetDragSource();
      return;
    }
    // Ctrl+Shift+S: save as (must come before other Ctrl checks)
    if (event.ctrlKey && event.shiftKey && event.key === "S") {
      event.preventDefault();
      handleSaveAs();
      return;
    }
    // Ctrl+N: new file
    if (event.ctrlKey && event.key === "n") {
      event.preventDefault();
      handleNewFile();
    }
    // Ctrl+W: close active pane
    if (event.ctrlKey && event.key === "w") {
      event.preventDefault();
      if (activePaneId) handleClosePane(activePaneId);
    }
    // Ctrl+E: toggle edit/view mode on active pane
    if (event.ctrlKey && event.key === "e") {
      event.preventDefault();
      if (activePaneId) handleToggleEdit(activePaneId);
    }
    // Ctrl+1/2/3/4: switch panes
    if (event.ctrlKey && event.key >= "1" && event.key <= "4") {
      event.preventDefault();
      const index = parseInt(event.key) - 1;
      if (index < panes.length) {
        handleActivatePane(panes[index].id);
      }
    }
  }

  onMount(() => {
    let unlistenFileChanged: (() => void) | undefined;
    let unlistenOpenFile: (() => void) | undefined;

    // Global keyboard shortcuts
    document.addEventListener("keydown", handleKeyDown);

    // Prevent WebView2 from handling ANY drag/drop at the document level.
    // This is the standard fix for WebView2 DnD issues on Windows 11.
    function globalDragOver(e: Event) { e.preventDefault(); }
    function globalDrop(e: Event) { e.preventDefault(); }
    function globalDragEnd() { resetDragSource(); }

    document.addEventListener("dragover", globalDragOver);
    document.addEventListener("drop", globalDrop);
    document.addEventListener("dragend", globalDragEnd);

    (async () => {
      // Check if a file was passed via CLI args or OS file association
      const initialFile = await getInitialFile();
      if (initialFile) {
        await openFileFromOS(initialFile);
      } else {
        // Normal startup: check for a saved folder, then fall back to Rust backend default
        const savedFolder = getDocsFolder();
        if (savedFolder) {
          docsPath = savedFolder;
        } else {
          try {
            docsPath = await getDocsPath();
          } catch (e) {
            console.error("Failed to get docs path:", e);
            dismissSplash();
            return;
          }
        }

        await loadTree();

        // Restore saved panes, or fall back to last selected file, or auto-select first
        const savedPanes = getOpenPanes();
        const validPanes = savedPanes.filter((p) => findEntryByPath(sortedTree, p));

        if (validPanes.length > 0) {
          for (const path of validPanes) {
            try {
              const content = await readFileContents(path);
              const id = createPaneId();
              panes = [...panes, { id, path, content }];
              activePaneId = id; // Last one becomes active
            } catch {
              // Skip files that can't be read
            }
          }
        } else {
          const lastPath = getLastSelectedPath();
          if (lastPath && findEntryByPath(sortedTree, lastPath)) {
            await openInActivePane(lastPath);
          } else {
            const firstFile = findFirstFile(sortedTree);
            if (firstFile) {
              await openInActivePane(firstFile.path);
            }
          }
        }

        // Start file watcher
        try {
          await startWatching(docsPath);
        } catch (e) {
          console.error("Failed to start file watcher:", e);
        }
      }

      // Listen for file opens from second instances (single-instance plugin)
      unlistenOpenFile = await listen<string>("open-file", (event) => {
        openFileFromOS(event.payload);
      });

      // Listen for file changes — batch events at 300ms to prevent flooding
      let pendingChangedPaths = new Set<string>();
      let watcherBatchTimer: ReturnType<typeof setTimeout> | undefined;

      unlistenFileChanged = await listen<string[]>("file-changed", (event) => {
        // During move/rename ops, suppress all watcher events entirely
        if (Date.now() < suppressWatcherUntil) return;

        for (const p of event.payload) {
          pendingChangedPaths.add(p);
        }
        if (watcherBatchTimer) clearTimeout(watcherBatchTimer);
        watcherBatchTimer = setTimeout(async () => {
          const changedPaths = new Set(pendingChangedPaths);
          pendingChangedPaths.clear();

          // If ALL changed paths are our own recent writes, skip tree reload entirely
          const allOwnWrites = [...changedPaths].every((p) => recentOwnWrites.has(p));
          if (!allOwnWrites) {
            await loadTree();
          }

          // Reload affected panes (skip edit-mode and own-write panes)
          for (const pane of panes) {
            if (pane.editMode) continue;
            if (recentOwnWrites.has(pane.path)) continue;
            if (changedPaths.has(pane.path)) {
              try {
                const content = await readFileContents(pane.path);
                panes = panes.map((p) =>
                  p.id === pane.id ? { ...p, content } : p
                );
              } catch {
                // Non-fatal
              }
            }
          }
        }, 300);
      });

      // Ensure theme file exists for next launch (handles upgrade from older versions)
      saveThemeFile(theme).catch(() => {});

      dismissSplash();
    })();

    return () => {
      unlistenFileChanged?.();
      unlistenOpenFile?.();
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("dragover", globalDragOver);
      document.removeEventListener("drop", globalDrop);
      document.removeEventListener("dragend", globalDragEnd);
    };
  });
</script>

<div class="app-layout">
  <Sidebar entries={tree} {selectedPath} {selectedFolderPath} onselect={(path, event, lineContent) => handleSelect(path, event, lineContent)} onchangefolder={handleChangeFolder} {sortMode} onsortchange={handleSortChange} onhelp={handleHelp} {helpActive} {filterQuery} onfilterchange={handleFilterChange} {searchMode} onsearchmodechange={handleSearchModeChange} {searchResults} {searchQuery} onsearchchange={handleSearchChange} {isSearching} onnewfile={handleNewFile} onnewfolder={handleNewFolder} {creatingFile} {creatingFolder} oncreatenewfile={handleCreateNewFile} oncancelcreate={handleCancelCreate} oncreatenewfolder={handleCreateNewFolder} oncancelcreatefolder={handleCancelCreateFolder} {newFileError} {newFolderError} onfocuschange={handleFocusChange} onfolderselect={handleFolderSelect} onmovefile={handleMoveFile} {renamingPath} {renameError} onstartrename={handleStartRename} onconfirmrename={handleConfirmRename} oncancelrename={handleCancelRename} ondelete={handleDeleteFile} onsaveas={handleSaveAsForPath} {docsPath} {theme} onthemetoggle={handleThemeToggle} />
  <ContentArea {panes} {activePaneId} {layoutMode} onlayoutchange={handleLayoutChange} onclosepane={handleClosePane} onactivatepane={handleActivatePane} ontoggleedit={handleToggleEdit} onsave={handleSave} onsaveas={handleSaveAsFromPane} {highlightText} {highlightKey} {theme} />
</div>

<style>
  .app-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100%;
    overflow: hidden;
  }
</style>
