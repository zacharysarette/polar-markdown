<script lang="ts">
  import { onMount, tick } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import ContentArea from "./lib/components/ContentArea.svelte";
  import Toast from "./lib/components/Toast.svelte";
  import { fixMermaidInMarkdown } from "./lib/services/mermaid-fixer";
  import {
    readDirectoryTree,
    readFileContents,
    writeFileContents,
    startWatching,
    getDocsPath,
    getHelpContent,
    getMuseumContent,
    pickFolder,
    searchFiles,
    findBacklinks,
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
    updateJumpList,
    getInitialFolder,
    readDirectoryFiles,
    restoreDirectoryFiles,
  } from "./lib/services/filesystem";
  import { UndoManager } from "./lib/services/undo";
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
    saveLineNumbers,
    getLineNumbers,
    addRecentFolder,
    getRecentFolders,
    saveZoomLevel,
    getZoomLevel,
    saveTocVisible,
    getTocVisible,
    saveDocStatsVisible,
    getDocStatsVisible,
  } from "./lib/services/persistence";
  import { setMermaidTheme, setBobDarkMode } from "./lib/services/markdown";
  import { findFirstFile, filterEntries } from "./lib/services/tree-utils";
  import { sortEntries, type SortMode } from "./lib/services/sort";
  import { resetDragSource } from "./lib/components/FileTreeItem.svelte";
  import { extractHeadings } from "./lib/services/toc";
  import type { FileEntry, LayoutMode, OpenPane, SearchResult, ThemeType, TocEntry, UndoAction } from "./lib/types";

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
  let showLineNumbers = $state(getLineNumbers());
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
  let scrollToId = $state("");
  let loading = $state(false);
  let zoomLevel = $state(getZoomLevel());
  let tocVisible = $state(getTocVisible());
  let showDocStats = $state(getDocStatsVisible());
  let activeTocSlug = $state("");
  let backlinks: SearchResult[] = $state([]);
  let backlinkDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.1;
  const undoManager = new UndoManager();
  const recentOwnWrites = new Set<string>();
  let suppressWatcherUntil = 0;
  let savedPaneBeforeHelp: { path: string; content: string; editMode?: boolean } | null = null;
  let toastMessage = $state("");
  let toastVisible = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

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
  let tocEntries: TocEntry[] = $derived.by(() => {
    const activePane = panes.find((p) => p.id === activePaneId);
    return activePane?.content ? extractHeadings(activePane.content) : [];
  });

  // Fetch backlinks when active pane changes
  $effect(() => {
    const activePane = panes.find((p) => p.id === activePaneId);
    const _path = activePane?.path;
    const _docs = docsPath;

    if (backlinkDebounceTimer) clearTimeout(backlinkDebounceTimer);

    if (!activePane || !_docs || activePane.readOnly) {
      backlinks = [];
      return;
    }

    const filename = _path?.split(/[\\/]/).pop() ?? "";
    if (!filename) {
      backlinks = [];
      return;
    }

    backlinkDebounceTimer = setTimeout(async () => {
      try {
        backlinks = await findBacklinks(_docs, filename);
      } catch {
        backlinks = [];
      }
    }, 300);

    return () => {
      if (backlinkDebounceTimer) clearTimeout(backlinkDebounceTimer);
    };
  });

  async function loadTree() {
    if (!docsPath) return;
    try {
      rawTree = await readDirectoryTree(docsPath);
    } catch (e) {
      console.error("Failed to load directory tree:", e);
    }
  }

  function refreshJumpList(folder: string) {
    const folders = addRecentFolder(folder);
    updateJumpList(folders).catch(() => {}); // fire-and-forget
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
    scrollToId = "";
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
      const pane = panes.find((p) => p.path === path);
      const previousContent = pane?.content ?? "";

      recentOwnWrites.add(path);
      await writeFileContents(path, content);

      if (content !== previousContent) {
        const sep = path.includes("\\") ? "\\" : "/";
        const filename = path.split(sep).pop() ?? path;
        undoManager.push({
          type: "save-file",
          path,
          previousContent,
          newContent: content,
          description: `Save ${filename}`,
        });
      }

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
    loading = true;
    undoManager.clear();
    refreshJumpList(path);
    await loadTree();
    loading = false;

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
    refreshJumpList(parentDir);
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

  function handleLineNumbersChange(enabled: boolean) {
    showLineNumbers = enabled;
    saveLineNumbers(enabled);
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
        panes = [{ id, path: "How to Use Glacimark.md", content, readOnly: true, editMode: false }];
        activePaneId = id;
        savedPaneBeforeHelp = null;
      } else {
        panes = panes.map((p) =>
          p.id === activePaneId
            ? { ...p, path: "How to Use Glacimark.md", content, readOnly: true, editMode: false }
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

      undoManager.push({
        type: "create-file",
        path: newPath,
        content,
        directory: targetDir,
        filename,
        description: `Create ${filename}`,
      });

      recentOwnWrites.add(newPath);
      openInActivePane(newPath, true, content);
      await loadTree();
      setTimeout(() => recentOwnWrites.delete(newPath), 500);
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

      undoManager.push({
        type: "create-directory",
        path: newPath,
        description: `Create folder ${name}`,
      });

      recentOwnWrites.add(newPath);
      await loadTree();
      setTimeout(() => recentOwnWrites.delete(newPath), 500);
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

      const moveSep = old_path.includes("\\") ? "\\" : "/";
      const moveName = old_path.split(moveSep).pop() ?? old_path;
      undoManager.push({
        type: isDir ? "move-directory" : "move-file",
        oldPath: old_path,
        newPath: new_path,
        description: `Move ${moveName}`,
      });

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

      undoManager.push({
        type: "rename-file",
        oldPath,
        newPath,
        description: `Rename to ${newName}`,
      });

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
      let savedContent = "";
      let savedDirFiles: { relative_path: string; content: string }[] = [];

      if (isDir) {
        try { savedDirFiles = await readDirectoryFiles(path); } catch { /* best-effort */ }
      } else {
        try { savedContent = await readFileContents(path); } catch { /* best-effort */ }
      }

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

      if (isDir) {
        undoManager.push({ type: "delete-directory", path, files: savedDirFiles, description: `Delete folder ${name}` });
      } else {
        undoManager.push({ type: "delete-file", path, content: savedContent, description: `Delete ${name}` });
      }

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

  /** Map of virtual filenames to their embedded content loaders. */
  const EMBEDDED_DOCS: Record<string, () => Promise<string>> = {
    "How to Use Glacimark.md": getHelpContent,
    "test.md": getMuseumContent,
  };

  async function handleFileLink(path: string, hash?: string, ctrlKey?: boolean) {
    scrollToId = "";

    // When navigating from a read-only (embedded) pane, check for embedded targets
    const activePane = panes.find((p) => p.id === activePaneId);
    if (activePane?.readOnly) {
      const filename = path.split("/").pop() ?? path;
      const loader = EMBEDDED_DOCS[filename];
      if (loader) {
        const content = await loader();
        if (ctrlKey && panes.length < MAX_PANES) {
          const id = createPaneId();
          panes = [...panes, { id, path: filename, content, readOnly: true, editMode: false }];
          activePaneId = id;
        } else {
          panes = panes.map((p) =>
            p.id === activePaneId
              ? { ...p, path: filename, content, readOnly: true, editMode: false }
              : p
          );
        }
        if (hash) {
          await tick();
          scrollToId = hash;
        }
        return;
      }
    }

    // Normal file link handling (reads from disk)
    if (ctrlKey && panes.length < MAX_PANES) {
      await openInNewPane(path);
    } else {
      await openInActivePane(path);
    }
    if (hash) {
      await tick();
      scrollToId = hash;
    }
  }

  function handleCopyPath(path: string) {
    navigator.clipboard.writeText(path);
  }

  async function handleToggleFullscreen() {
    const win = getCurrentWebviewWindow();
    const isFs = await win.isFullscreen();
    await win.setFullscreen(!isFs);
  }

  function handleZoomIn() {
    zoomLevel = Math.min(ZOOM_MAX, Math.round((zoomLevel + ZOOM_STEP) * 10) / 10);
    saveZoomLevel(zoomLevel);
  }

  function handleZoomOut() {
    zoomLevel = Math.max(ZOOM_MIN, Math.round((zoomLevel - ZOOM_STEP) * 10) / 10);
    saveZoomLevel(zoomLevel);
  }

  function handleZoomReset() {
    zoomLevel = 1.0;
    saveZoomLevel(zoomLevel);
  }

  function handleTocToggle() {
    tocVisible = !tocVisible;
    saveTocVisible(tocVisible);
  }

  function handleDocStatsToggle() {
    showDocStats = !showDocStats;
    saveDocStatsVisible(showDocStats);
  }

  function handleTocSelect(slug: string) {
    scrollToId = "";
    requestAnimationFrame(() => { scrollToId = slug; });
  }

  function handleActiveHeadingChange(slug: string) {
    activeTocSlug = slug;
  }

  function handleBacklinkSelect(path: string) {
    handleFileLink(path);
  }

  function showToast(msg: string, duration = 3000) {
    toastMessage = msg;
    toastVisible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; }, duration);
  }

  function handleAutoFix(fixCount: number) {
    if (fixCount === 0) {
      showToast("No mermaid issues found");
    } else {
      showToast(`Auto-fixed ${fixCount} mermaid issue${fixCount === 1 ? '' : 's'}`);
    }
  }

  async function handleViewerAutoFix() {
    const pane = panes.find((p) => p.id === activePaneId);
    if (!pane || pane.readOnly) return;

    const { result, totalFixes } = fixMermaidInMarkdown(pane.content);
    if (totalFixes === 0) {
      showToast("No mermaid issues found");
      return;
    }

    try {
      // Push undo action before writing
      undoManager.push({
        type: "save-file",
        path: pane.path,
        previousContent: pane.content,
        newContent: result,
        description: `auto-fix mermaid in ${pane.path.split(/[\\/]/).pop()}`,
      });
      recentOwnWrites.add(pane.path);
      await writeFileContents(pane.path, result);
      panes = panes.map((p) =>
        p.path === pane.path ? { ...p, content: result } : p
      );
      setTimeout(() => recentOwnWrites.delete(pane.path), 500);
      showToast(`Auto-fixed ${totalFixes} mermaid issue${totalFixes === 1 ? '' : 's'}`);
    } catch (e) {
      console.error("Failed to save auto-fixed content:", e);
      recentOwnWrites.delete(pane.path);
    }
  }

  async function executeUndo() {
    const action = undoManager.undo();
    if (!action) return;

    suppressWatcherUntil = Date.now() + 2000;

    try {
      switch (action.type) {
        case "create-file": {
          recentOwnWrites.add(action.path);
          await deleteFile(action.path);
          panes = panes.filter((p) => p.path !== action.path);
          if (!panes.find((p) => p.id === activePaneId)) {
            activePaneId = panes.length > 0 ? panes[panes.length - 1].id : "";
          }
          persistPanes();
          await loadTree();
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
        case "delete-file": {
          recentOwnWrites.add(action.path);
          await writeFileContents(action.path, action.content);
          await openInActivePane(action.path, false, action.content);
          await loadTree();
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
        case "delete-directory": {
          await restoreDirectoryFiles(action.path, action.files);
          await loadTree();
          break;
        }
        case "rename-file": {
          const sep = action.oldPath.includes("\\") ? "\\" : "/";
          const oldName = action.oldPath.split(sep).pop() ?? "";
          recentOwnWrites.add(action.oldPath);
          recentOwnWrites.add(action.newPath);
          await renameFile(action.newPath, oldName);
          panes = panes.map((p) =>
            p.path === action.newPath ? { ...p, path: action.oldPath } : p
          );
          persistPanes();
          await loadTree();
          setTimeout(() => { recentOwnWrites.delete(action.oldPath); recentOwnWrites.delete(action.newPath); }, 2000);
          break;
        }
        case "move-file": {
          const sep = action.oldPath.includes("\\") ? "\\" : "/";
          const oldDir = action.oldPath.split(sep).slice(0, -1).join(sep);
          recentOwnWrites.add(action.oldPath);
          recentOwnWrites.add(action.newPath);
          await moveFile(action.newPath, oldDir);
          panes = panes.map((p) =>
            p.path === action.newPath ? { ...p, path: action.oldPath } : p
          );
          persistPanes();
          await loadTree();
          setTimeout(() => { recentOwnWrites.delete(action.oldPath); recentOwnWrites.delete(action.newPath); }, 2000);
          break;
        }
        case "move-directory": {
          const sep = action.oldPath.includes("\\") ? "\\" : "/";
          const oldDir = action.oldPath.split(sep).slice(0, -1).join(sep);
          recentOwnWrites.add(action.oldPath);
          recentOwnWrites.add(action.newPath);
          await moveDirectory(action.newPath, oldDir);
          const oldPrefix = action.newPath + sep;
          const newPrefix = action.oldPath + sep;
          panes = panes.map((p) => {
            if (p.path === action.newPath) return { ...p, path: action.oldPath };
            if (p.path.startsWith(oldPrefix)) return { ...p, path: newPrefix + p.path.slice(oldPrefix.length) };
            return p;
          });
          persistPanes();
          await loadTree();
          setTimeout(() => { recentOwnWrites.delete(action.oldPath); recentOwnWrites.delete(action.newPath); }, 2000);
          break;
        }
        case "save-file": {
          recentOwnWrites.add(action.path);
          await writeFileContents(action.path, action.previousContent);
          panes = panes.map((p) =>
            p.path === action.path ? { ...p, content: action.previousContent } : p
          );
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
        case "create-directory": {
          recentOwnWrites.add(action.path);
          await deleteDirectory(action.path);
          if (selectedFolderPath === action.path) selectedFolderPath = "";
          await loadTree();
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
      }
      showToast(`Undo: ${action.description}`);
    } catch (e) {
      console.error("Undo failed:", e);
      showToast("Undo failed");
    }
  }

  async function executeRedo() {
    const action = undoManager.redo();
    if (!action) return;

    suppressWatcherUntil = Date.now() + 2000;

    try {
      switch (action.type) {
        case "create-file": {
          recentOwnWrites.add(action.path);
          await writeFileContents(action.path, action.content);
          await openInActivePane(action.path, false, action.content);
          await loadTree();
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
        case "delete-file": {
          recentOwnWrites.add(action.path);
          await deleteFile(action.path);
          panes = panes.filter((p) => p.path !== action.path);
          if (!panes.find((p) => p.id === activePaneId)) {
            activePaneId = panes.length > 0 ? panes[panes.length - 1].id : "";
          }
          persistPanes();
          await loadTree();
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
        case "delete-directory": {
          recentOwnWrites.add(action.path);
          await deleteDirectory(action.path);
          const sep = action.path.includes("\\") ? "\\" : "/";
          const dirPrefix = action.path.endsWith(sep) ? action.path : action.path + sep;
          panes = panes.filter((p) => p.path !== action.path && !p.path.startsWith(dirPrefix));
          if (!panes.find((p) => p.id === activePaneId)) {
            activePaneId = panes.length > 0 ? panes[panes.length - 1].id : "";
          }
          persistPanes();
          await loadTree();
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
        case "rename-file": {
          const sep = action.newPath.includes("\\") ? "\\" : "/";
          const newName = action.newPath.split(sep).pop() ?? "";
          recentOwnWrites.add(action.oldPath);
          recentOwnWrites.add(action.newPath);
          await renameFile(action.oldPath, newName);
          panes = panes.map((p) =>
            p.path === action.oldPath ? { ...p, path: action.newPath } : p
          );
          persistPanes();
          await loadTree();
          setTimeout(() => { recentOwnWrites.delete(action.oldPath); recentOwnWrites.delete(action.newPath); }, 2000);
          break;
        }
        case "move-file": {
          const sep = action.newPath.includes("\\") ? "\\" : "/";
          const newDir = action.newPath.split(sep).slice(0, -1).join(sep);
          recentOwnWrites.add(action.oldPath);
          recentOwnWrites.add(action.newPath);
          await moveFile(action.oldPath, newDir);
          panes = panes.map((p) =>
            p.path === action.oldPath ? { ...p, path: action.newPath } : p
          );
          persistPanes();
          await loadTree();
          setTimeout(() => { recentOwnWrites.delete(action.oldPath); recentOwnWrites.delete(action.newPath); }, 2000);
          break;
        }
        case "move-directory": {
          const sep = action.newPath.includes("\\") ? "\\" : "/";
          const newDir = action.newPath.split(sep).slice(0, -1).join(sep);
          recentOwnWrites.add(action.oldPath);
          recentOwnWrites.add(action.newPath);
          await moveDirectory(action.oldPath, newDir);
          const oldPrefix = action.oldPath + sep;
          const newPrefix = action.newPath + sep;
          panes = panes.map((p) => {
            if (p.path === action.oldPath) return { ...p, path: action.newPath };
            if (p.path.startsWith(oldPrefix)) return { ...p, path: newPrefix + p.path.slice(oldPrefix.length) };
            return p;
          });
          persistPanes();
          await loadTree();
          setTimeout(() => { recentOwnWrites.delete(action.oldPath); recentOwnWrites.delete(action.newPath); }, 2000);
          break;
        }
        case "save-file": {
          recentOwnWrites.add(action.path);
          await writeFileContents(action.path, action.newContent);
          panes = panes.map((p) =>
            p.path === action.path ? { ...p, content: action.newContent } : p
          );
          setTimeout(() => recentOwnWrites.delete(action.path), 2000);
          break;
        }
        case "create-directory": {
          const sep = action.path.includes("\\") ? "\\" : "/";
          const parts = action.path.split(sep);
          const folderName = parts.pop() ?? "";
          const parentDir = parts.join(sep);
          await createDirectory(parentDir, folderName);
          await loadTree();
          break;
        }
      }
      showToast(`Redo: ${action.description}`);
    } catch (e) {
      console.error("Redo failed:", e);
      showToast("Redo failed");
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Alt+Enter: toggle fullscreen
    if (event.altKey && event.key === "Enter") {
      event.preventDefault();
      handleToggleFullscreen();
      return;
    }
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
    // Ctrl+Z: undo (skip if CodeMirror editor is focused)
    if (event.ctrlKey && !event.shiftKey && event.key === "z") {
      const active = document.activeElement;
      if (active && active.closest(".cm-editor")) return;
      event.preventDefault();
      executeUndo();
      return;
    }
    // Ctrl+Shift+Z or Ctrl+Y: redo (skip if CodeMirror is focused)
    if ((event.ctrlKey && event.shiftKey && event.key === "Z") ||
        (event.ctrlKey && !event.shiftKey && event.key === "y")) {
      const active = document.activeElement;
      if (active && active.closest(".cm-editor")) return;
      event.preventDefault();
      executeRedo();
      return;
    }
    // Ctrl+= / Ctrl++: zoom in
    if (event.ctrlKey && (event.key === "=" || event.key === "+")) {
      event.preventDefault();
      handleZoomIn();
      return;
    }
    // Ctrl+-: zoom out
    if (event.ctrlKey && event.key === "-") {
      event.preventDefault();
      handleZoomOut();
      return;
    }
    // Ctrl+0: reset zoom
    if (event.ctrlKey && event.key === "0") {
      event.preventDefault();
      handleZoomReset();
      return;
    }
    // Ctrl+T: toggle table of contents
    if (event.ctrlKey && event.key === "t") {
      event.preventDefault();
      handleTocToggle();
      return;
    }
    // Ctrl+I: toggle document stats (skip if CodeMirror editor is focused)
    if (event.ctrlKey && event.key === "i") {
      const active = document.activeElement;
      if (active && active.closest(".cm-editor")) return;
      event.preventDefault();
      handleDocStatsToggle();
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
    let unlistenOpenFolder: (() => void) | undefined;
    let unlistenMenuNewFile: (() => void) | undefined;
    let unlistenMenuOpenFolder: (() => void) | undefined;
    let unlistenMenuSaveAs: (() => void) | undefined;
    let unlistenMenuClosePane: (() => void) | undefined;
    let unlistenMenuToggleEdit: (() => void) | undefined;
    let unlistenMenuHelp: (() => void) | undefined;
    let unlistenMenuToggleFullscreen: (() => void) | undefined;

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

    // Ctrl+wheel zoom (intercept before browser zoom)
    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else if (e.deltaY > 0) handleZoomOut();
    }
    document.addEventListener("wheel", handleWheel, { passive: false });

    (async () => {
      const appWindow = getCurrentWebviewWindow();

      // Check if a folder was passed via --open-folder (jump list click)
      const initialFolder = await getInitialFolder();
      // Check if a file was passed via CLI args or OS file association
      const initialFile = !initialFolder ? await getInitialFile() : null;

      if (initialFolder) {
        saveDocsFolder(initialFolder);
        await switchToFolder(initialFolder);
      } else if (initialFile) {
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

      // Listen for folder opens from jump list clicks (single-instance plugin)
      unlistenOpenFolder = await appWindow.listen<string>("open-folder", (event) => {
        saveDocsFolder(event.payload);
        switchToFolder(event.payload);
      });

      // Listen for file opens from second instances (single-instance plugin)
      unlistenOpenFile = await appWindow.listen<string>("open-file", (event) => {
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

      // Listen for native menu events (window-scoped — only this window responds)
      unlistenMenuNewFile = await appWindow.listen("menu-new-file", () => handleNewFile());
      unlistenMenuOpenFolder = await appWindow.listen("menu-open-folder", () => handleChangeFolder());
      unlistenMenuSaveAs = await appWindow.listen("menu-save-as", () => handleSaveAs());
      unlistenMenuClosePane = await appWindow.listen("menu-close-pane", () => { if (activePaneId) handleClosePane(activePaneId); });
      unlistenMenuToggleEdit = await appWindow.listen("menu-toggle-edit", () => { if (activePaneId) handleToggleEdit(activePaneId); });
      unlistenMenuHelp = await appWindow.listen("menu-help", () => handleHelp());
      unlistenMenuToggleFullscreen = await appWindow.listen("menu-toggle-fullscreen", () => handleToggleFullscreen());

      // Ensure theme file exists for next launch (handles upgrade from older versions)
      saveThemeFile(theme).catch(() => {});

      // Rebuild jump list on startup to clean stale entries
      updateJumpList(getRecentFolders()).catch(() => {});

      dismissSplash();
    })();

    return () => {
      unlistenFileChanged?.();
      unlistenOpenFile?.();
      unlistenOpenFolder?.();
      unlistenMenuNewFile?.();
      unlistenMenuOpenFolder?.();
      unlistenMenuSaveAs?.();
      unlistenMenuClosePane?.();
      unlistenMenuToggleEdit?.();
      unlistenMenuHelp?.();
      unlistenMenuToggleFullscreen?.();
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("dragover", globalDragOver);
      document.removeEventListener("drop", globalDrop);
      document.removeEventListener("dragend", globalDragEnd);
      document.removeEventListener("wheel", handleWheel);
    };
  });
</script>

<div class="app-layout">
  <Sidebar entries={tree} {selectedPath} {selectedFolderPath} onselect={(path, event, lineContent) => handleSelect(path, event, lineContent)} onchangefolder={handleChangeFolder} {sortMode} onsortchange={handleSortChange} onhelp={handleHelp} {helpActive} {filterQuery} onfilterchange={handleFilterChange} {searchMode} onsearchmodechange={handleSearchModeChange} {searchResults} {searchQuery} onsearchchange={handleSearchChange} {isSearching} onnewfile={handleNewFile} onnewfolder={handleNewFolder} {creatingFile} {creatingFolder} oncreatenewfile={handleCreateNewFile} oncancelcreate={handleCancelCreate} oncreatenewfolder={handleCreateNewFolder} oncancelcreatefolder={handleCancelCreateFolder} {newFileError} {newFolderError} onfocuschange={handleFocusChange} onfolderselect={handleFolderSelect} onmovefile={handleMoveFile} {renamingPath} {renameError} onstartrename={handleStartRename} onconfirmrename={handleConfirmRename} oncancelrename={handleCancelRename} ondelete={handleDeleteFile} onsaveas={handleSaveAsForPath} {docsPath} {theme} onthemetoggle={handleThemeToggle} oncopypath={handleCopyPath} {loading} />
  <ContentArea {panes} {activePaneId} {layoutMode} onlayoutchange={handleLayoutChange} {showLineNumbers} onlinenumberschange={handleLineNumbersChange} onclosepane={handleClosePane} onactivatepane={handleActivatePane} ontoggleedit={handleToggleEdit} onsave={handleSave} onsaveas={handleSaveAsFromPane} {highlightText} {highlightKey} {theme} onfilelink={handleFileLink} {scrollToId} {zoomLevel} onautofix={handleAutoFix} onviewerautofix={handleViewerAutoFix} onactiveheadingchange={handleActiveHeadingChange} {tocVisible} {tocEntries} {activeTocSlug} ontocselect={handleTocSelect} ontocclose={handleTocToggle} ontoctoggle={handleTocToggle} tocFileName={panes.find(p => p.id === activePaneId)?.path?.split(/[\\/]/).pop() ?? ""} {backlinks} onbacklinkselect={handleBacklinkSelect} {showDocStats} ondocstatstoggle={handleDocStatsToggle} />
</div>
<Toast message={toastMessage} visible={toastVisible} />

<style>
  .app-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100%;
    overflow: hidden;
  }
</style>
