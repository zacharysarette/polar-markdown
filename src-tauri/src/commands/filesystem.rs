use crate::models::{CreateFileResult, DirectoryFileContent, FileEntry, MoveFileResult, RenameFileResult, SearchMatch, SearchResult};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri::Manager;
use walkdir::WalkDir;

/// Help file content embedded at compile time — always available regardless of install location.
const HELP_CONTENT: &str = include_str!("../../../docs/How to Use Glacimark.md");

/// Museum file content embedded at compile time — available for help-flow navigation.
const MUSEUM_CONTENT: &str = include_str!("../../../docs/test.md");

/// Recursively reads a directory tree, filtering to .md files and directories
/// that contain .md files. Skips hidden directories.
/// Returns entries sorted: directories first, then alphabetical.
fn build_tree(dir_path: &Path) -> Vec<FileEntry> {
    let read_dir = match fs::read_dir(dir_path) {
        Ok(rd) => rd,
        Err(_) => return vec![],
    };

    let mut entries: Vec<FileEntry> = Vec::new();

    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        let modified = entry.metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        if path.is_dir() {
            let children = build_tree(&path);
            // Include all directories (even empty ones, so users can see newly created folders)
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory: true,
                children,
                modified,
            });
        } else if name.ends_with(".md") {
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory: false,
                children: vec![],
                modified,
            });
        }
    }

    // Sort: directories first, then alphabetical by name
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    entries
}

#[tauri::command]
pub fn read_directory_tree(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    Ok(build_tree(dir))
}

#[tauri::command]
pub fn read_file_contents(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
pub fn write_file_contents(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to write file {}: {}", path, e))
}

/// Returns the absolute path to the docs/ directory.
/// In dev mode: navigates up from the exe in src-tauri/target/debug/
/// In production: looks for docs/ next to the executable.
#[tauri::command]
pub fn get_docs_path() -> Result<String, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    let exe_dir = exe.parent()
        .ok_or("Failed to get exe directory")?;

    // Dev mode: exe is at src-tauri/target/debug/app.exe
    // Go up 3 levels to project root, then into docs/
    let dev_docs = exe_dir
        .join("..")
        .join("..")
        .join("..")
        .join("docs");

    if let Ok(canonical) = fs::canonicalize(&dev_docs) {
        if canonical.is_dir() {
            return Ok(canonical.to_string_lossy().to_string());
        }
    }

    // Production: docs/ next to the executable
    let prod_docs = exe_dir.join("docs");
    if prod_docs.is_dir() {
        return Ok(prod_docs.to_string_lossy().to_string());
    }

    // Last resort: try CWD/docs
    if let Ok(cwd) = std::env::current_dir() {
        let cwd_docs = cwd.join("docs");
        if cwd_docs.is_dir() {
            return Ok(cwd_docs.to_string_lossy().to_string());
        }
    }

    Err("Could not find docs/ directory".into())
}

/// Derives a title from a filename: strips .md, replaces - and _ with spaces, title-cases.
fn title_from_filename(filename: &str) -> String {
    let stem = filename.strip_suffix(".md").unwrap_or(filename);
    stem.split(|c: char| c == '-' || c == '_')
        .filter(|w| !w.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    upper + &chars.collect::<String>()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Creates a new markdown file in the given directory with a template heading.
/// Auto-appends .md if missing. Refuses to overwrite existing files.
/// Validates: non-empty filename, no path separators.
#[tauri::command]
pub fn create_file(directory: String, filename: String) -> Result<CreateFileResult, String> {
    let filename = filename.trim().to_string();

    if filename.is_empty() {
        return Err("Filename cannot be empty".into());
    }

    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Filename cannot contain path separators".into());
    }

    let filename = if filename.ends_with(".md") {
        filename
    } else {
        format!("{}.md", filename)
    };

    let dir = Path::new(&directory);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Directory does not exist: {}", directory));
    }

    let file_path = dir.join(&filename);
    if file_path.exists() {
        return Err(format!("File already exists: {}", filename));
    }

    let title = title_from_filename(&filename);
    let content = format!("# {}\n\n", title);

    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(CreateFileResult {
        path: file_path.to_string_lossy().to_string(),
        content,
    })
}

/// Renames a markdown file. Takes the full old path and a new filename (not path).
/// Auto-appends .md if missing. Validates like create_file.
/// No-op if renaming to the same name. Refuses if target already exists.
#[tauri::command]
pub fn rename_file(old_path: String, new_name: String) -> Result<RenameFileResult, String> {
    let new_name = new_name.trim().to_string();

    if new_name.is_empty() {
        return Err("Filename cannot be empty".into());
    }

    if new_name.contains('/') || new_name.contains('\\') || new_name.contains("..") {
        return Err("Filename cannot contain path separators".into());
    }

    let new_name = if new_name.ends_with(".md") {
        new_name
    } else {
        format!("{}.md", new_name)
    };

    let old = Path::new(&old_path);
    if !old.exists() {
        return Err(format!("Source file does not exist: {}", old_path));
    }

    let parent = old.parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;

    let new_path = parent.join(&new_name);

    // No-op if renaming to the same name
    if old == new_path {
        return Ok(RenameFileResult {
            old_path: old_path.clone(),
            new_path: old_path,
        });
    }

    if new_path.exists() {
        return Err(format!("File already exists: {}", new_name));
    }

    fs::rename(&old, &new_path)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    Ok(RenameFileResult {
        old_path,
        new_path: new_path.to_string_lossy().to_string(),
    })
}

/// Deletes a markdown file. Validates existence, type, and extension before removing.
#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let file = Path::new(&path);
    if !file.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file.is_file() {
        return Err("Can only delete files, not directories".into());
    }
    if !path.to_lowercase().ends_with(".md") {
        return Err("Can only delete markdown (.md) files".into());
    }
    if path.contains("..") {
        return Err("Invalid file path".into());
    }
    trash::delete(file).map_err(|e| format!("Failed to delete file: {}", e))
}

/// Deletes a directory and all its contents recursively.
/// Validates existence, type (must be directory), and rejects path traversal.
#[tauri::command]
pub fn delete_directory(path: String) -> Result<(), String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !dir.is_dir() {
        return Err("Can only delete directories, not files".into());
    }
    if path.contains("..") {
        return Err("Invalid directory path".into());
    }
    trash::delete(dir).map_err(|e| format!("Failed to delete directory: {}", e))
}

/// Creates a new directory inside the given parent directory.
/// Validates: non-empty name, no path separators, parent exists, no duplicates.
#[tauri::command]
pub fn create_directory(parent: String, name: String) -> Result<String, String> {
    let name = name.trim().to_string();

    if name.is_empty() {
        return Err("Folder name cannot be empty".into());
    }

    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("Folder name cannot contain path separators".into());
    }

    let parent_dir = Path::new(&parent);
    if !parent_dir.exists() || !parent_dir.is_dir() {
        return Err(format!("Parent directory does not exist: {}", parent));
    }

    let new_dir = parent_dir.join(&name);
    if new_dir.exists() {
        return Err(format!("'{}' already exists", name));
    }

    fs::create_dir(&new_dir)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    Ok(new_dir.to_string_lossy().to_string())
}

/// Moves a markdown file to a different directory.
/// Validates: source exists, is a file, is .md, target dir exists, no name collision.
#[tauri::command]
pub fn move_file(source_path: String, target_dir: String) -> Result<MoveFileResult, String> {
    let source = Path::new(&source_path);
    let target = Path::new(&target_dir);

    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    if !source.is_file() {
        return Err("Can only move files, not directories".into());
    }
    if !source_path.to_lowercase().ends_with(".md") {
        return Err("Can only move markdown (.md) files".into());
    }
    if !target.exists() || !target.is_dir() {
        return Err(format!("Target directory does not exist: {}", target_dir));
    }
    if source_path.contains("..") || target_dir.contains("..") {
        return Err("Invalid path".into());
    }

    let filename = source.file_name()
        .ok_or("Cannot determine filename")?;
    let new_path = target.join(filename);

    if new_path.exists() {
        return Err(format!("A file named '{}' already exists in the target folder",
            filename.to_string_lossy()));
    }

    fs::rename(&source, &new_path)
        .map_err(|e| format!("Failed to move file: {}", e))?;

    Ok(MoveFileResult {
        old_path: source_path,
        new_path: new_path.to_string_lossy().into_owned(),
    })
}

/// Moves a directory into another directory.
/// Validates: source exists, is a dir, target exists, is a dir, no path traversal,
/// not moving into self or descendant.
#[tauri::command]
pub fn move_directory(source_path: String, target_dir: String) -> Result<MoveFileResult, String> {
    let source = Path::new(&source_path);
    let target = Path::new(&target_dir);

    if !source.exists() {
        return Err(format!("Source directory does not exist: {}", source_path));
    }
    if !source.is_dir() {
        return Err("Source is not a directory".into());
    }
    if !target.exists() || !target.is_dir() {
        return Err(format!("Target directory does not exist: {}", target_dir));
    }
    if source_path.contains("..") || target_dir.contains("..") {
        return Err("Invalid path".into());
    }

    // Prevent moving a directory into itself or a descendant
    let source_canonical = fs::canonicalize(source)
        .map_err(|e| format!("Failed to resolve source path: {}", e))?;
    let target_canonical = fs::canonicalize(target)
        .map_err(|e| format!("Failed to resolve target path: {}", e))?;

    if target_canonical == source_canonical || target_canonical.starts_with(&source_canonical) {
        return Err("Cannot move a directory into itself or its own subdirectory".into());
    }

    let dir_name = source.file_name()
        .ok_or("Cannot determine directory name")?;
    let new_path = target.join(dir_name);

    if new_path.exists() {
        return Err(format!("'{}' already exists in the target folder",
            dir_name.to_string_lossy()));
    }

    fs::rename(&source, &new_path)
        .map_err(|e| format!("Failed to move directory: {}", e))?;

    Ok(MoveFileResult {
        old_path: source_path,
        new_path: new_path.to_string_lossy().into_owned(),
    })
}

/// Reads all .md files in a directory recursively, returning their relative paths and contents.
/// Used to capture directory contents before deletion for undo support.
#[tauri::command]
pub fn read_directory_files(path: String) -> Result<Vec<DirectoryFileContent>, String> {
    let base = Path::new(&path);
    if !base.exists() || !base.is_dir() {
        return Err(format!("Directory does not exist: {}", path));
    }

    let mut files = Vec::new();

    for entry in WalkDir::new(base)
        .into_iter()
        .filter_entry(|e| {
            // Always include root; skip hidden entries below root
            e.path() == base || !e.file_name().to_string_lossy().starts_with('.')
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }

        if let Ok(content) = fs::read_to_string(entry_path) {
            let relative = entry_path
                .strip_prefix(base)
                .unwrap_or(entry_path)
                .to_string_lossy()
                .to_string();
            files.push(DirectoryFileContent {
                relative_path: relative,
                content,
            });
        }
    }

    Ok(files)
}

/// Recreates a directory structure and writes files from a saved snapshot.
/// Used to restore directory contents after undo of a directory delete.
#[tauri::command]
pub fn restore_directory_files(base_path: String, files: Vec<DirectoryFileContent>) -> Result<(), String> {
    let base = Path::new(&base_path);

    // Create the base directory if it doesn't exist
    fs::create_dir_all(base).map_err(|e| format!("Failed to create directory: {}", e))?;

    for file in &files {
        let file_path = base.join(&file.relative_path);

        // Create parent directories
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        fs::write(&file_path, &file.content)
            .map_err(|e| format!("Failed to write file {}: {}", file.relative_path, e))?;
    }

    Ok(())
}

/// Returns the file path passed via CLI args (if any), consuming it so subsequent calls return None.
#[tauri::command]
pub fn get_initial_file(state: tauri::State<'_, crate::InitialFileState>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

/// Returns the folder path passed via --open-folder CLI arg (if any), consuming it.
#[tauri::command]
pub fn get_initial_folder(state: tauri::State<'_, crate::InitialFolderState>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

/// Returns the embedded help file content (compiled into the binary).
#[tauri::command]
pub fn get_help_content() -> String {
    HELP_CONTENT.to_string()
}

/// Returns the embedded rendering museum content (compiled into the binary).
#[tauri::command]
pub fn get_museum_content() -> String {
    MUSEUM_CONTENT.to_string()
}

/// Searches the contents of all .md files in a directory for a query string.
/// Returns matching files with line numbers and content. Case-insensitive.
/// Skips hidden directories and non-.md files.
#[tauri::command]
pub fn search_files(path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let dir = Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Invalid directory: {}", path));
    }

    if query.is_empty() {
        return Ok(vec![]);
    }

    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    for entry in WalkDir::new(dir)
        .into_iter()
        .filter_entry(|e| {
            // Skip hidden directories
            !e.file_name().to_string_lossy().starts_with('.')
                || e.path() == dir
        })
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();

        // Only search .md files
        if !entry_path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".md") {
            continue;
        }

        // Read file and search line by line
        let content = match fs::read_to_string(entry_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut matches: Vec<SearchMatch> = Vec::new();
        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&query_lower) {
                matches.push(SearchMatch {
                    line_number: i + 1,
                    line_content: line.to_string(),
                });
            }
        }

        if !matches.is_empty() {
            results.push(SearchResult {
                path: entry_path.to_string_lossy().to_string(),
                name,
                matches,
            });
        }
    }

    // Sort results by file name for consistent ordering
    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(results)
}

/// Finds all .md files in a directory that contain wiki-style [[links]] pointing to the target file.
/// Returns results in the same format as search_files. Skips hidden dirs and the target file itself.
#[tauri::command]
pub fn find_backlinks(path: String, target: String) -> Result<Vec<SearchResult>, String> {
    let dir = Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Invalid directory: {}", path));
    }

    if target.is_empty() {
        return Ok(vec![]);
    }

    // Strip .md extension for matching: [[target]] or [[target.md]] both count
    let base_name = target.strip_suffix(".md").unwrap_or(&target);
    // Build regex: \[\[base_name(\.md)?(\|[^\]]+)?\]\] (case-insensitive)
    let escaped = regex::escape(base_name);
    let pattern = format!(r"\[\[{escaped}(\.md)?(\|[^\]]+)?\]\]");
    let re = regex::RegexBuilder::new(&pattern)
        .case_insensitive(true)
        .build()
        .map_err(|e| format!("Invalid regex: {}", e))?;

    let mut results: Vec<SearchResult> = Vec::new();

    for entry in WalkDir::new(dir)
        .into_iter()
        .filter_entry(|e| {
            !e.file_name().to_string_lossy().starts_with('.')
                || e.path() == dir
        })
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();

        if !entry_path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".md") {
            continue;
        }

        // Skip the target file itself
        let entry_stem = name.strip_suffix(".md").unwrap_or(&name);
        if entry_stem.eq_ignore_ascii_case(base_name) {
            continue;
        }

        let content = match fs::read_to_string(entry_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut matches: Vec<SearchMatch> = Vec::new();
        for (i, line) in content.lines().enumerate() {
            if re.is_match(line) {
                matches.push(SearchMatch {
                    line_number: i + 1,
                    line_content: line.to_string(),
                });
            }
        }

        if !matches.is_empty() {
            results.push(SearchResult {
                path: entry_path.to_string_lossy().to_string(),
                name,
                matches,
            });
        }
    }

    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(results)
}

#[tauri::command]
pub fn save_image(directory: String, filename: String, data: Vec<u8>) -> Result<String, String> {
    let filename = filename.trim().to_string();
    if filename.is_empty() {
        return Err("Filename cannot be empty".into());
    }
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Filename must not contain path separators or '..'".into());
    }

    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp") {
        return Err(format!("Unsupported image format: .{}", ext));
    }

    let dir = Path::new(&directory);
    let assets_dir = dir.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("Failed to create assets directory: {}", e))?;

    let file_path = assets_dir.join(&filename);
    fs::write(&file_path, &data).map_err(|e| format!("Failed to write image: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_theme(app_handle: tauri::AppHandle, theme: String) -> Result<(), String> {
    let dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("theme.txt");
    std::fs::write(path, theme).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_test_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();

        // Create structure:
        // tmp/
        //   docs/
        //     plan.md
        //     notes/
        //       note1.md
        //   .hidden/
        //     secret.md
        //   readme.md
        //   image.png

        let docs = dir.path().join("docs");
        let notes = docs.join("notes");
        let hidden = dir.path().join(".hidden");

        fs::create_dir_all(&notes).unwrap();
        fs::create_dir_all(&hidden).unwrap();

        fs::write(docs.join("plan.md"), "# Plan").unwrap();
        fs::write(notes.join("note1.md"), "# Note 1").unwrap();
        fs::write(hidden.join("secret.md"), "secret").unwrap();
        fs::write(dir.path().join("readme.md"), "# README").unwrap();
        fs::write(dir.path().join("image.png"), "fake png").unwrap();

        dir
    }

    #[test]
    fn test_read_directory_tree_returns_only_md_files() {
        let dir = setup_test_dir();
        let tree = read_directory_tree(dir.path().to_string_lossy().to_string()).unwrap();

        // Should have: docs/ folder and readme.md (no .hidden, no image.png)
        let names: Vec<&str> = tree.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"docs"));
        assert!(names.contains(&"readme.md"));
        assert!(!names.contains(&".hidden"));
        assert!(!names.contains(&"image.png"));
    }

    #[test]
    fn test_directories_sorted_before_files() {
        let dir = setup_test_dir();
        let tree = read_directory_tree(dir.path().to_string_lossy().to_string()).unwrap();

        // First entry should be docs/ (directory), last should be readme.md (file)
        assert!(tree[0].is_directory);
        assert!(!tree.last().unwrap().is_directory);
    }

    #[test]
    fn test_nested_directories_included() {
        let dir = setup_test_dir();
        let tree = read_directory_tree(dir.path().to_string_lossy().to_string()).unwrap();

        let docs = tree.iter().find(|e| e.name == "docs").unwrap();
        let notes = docs.children.iter().find(|e| e.name == "notes");
        assert!(notes.is_some());
        assert_eq!(notes.unwrap().children.len(), 1);
        assert_eq!(notes.unwrap().children[0].name, "note1.md");
    }

    #[test]
    fn test_hidden_dirs_skipped() {
        let dir = setup_test_dir();
        let tree = read_directory_tree(dir.path().to_string_lossy().to_string()).unwrap();

        let hidden = tree.iter().find(|e| e.name == ".hidden");
        assert!(hidden.is_none());
    }

    #[test]
    fn test_empty_directories_included() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("empty-folder")).unwrap();
        fs::write(dir.path().join("file.md"), "# File").unwrap();

        let tree = read_directory_tree(dir.path().to_string_lossy().to_string()).unwrap();
        let empty = tree.iter().find(|e| e.name == "empty-folder");
        assert!(empty.is_some());
        assert!(empty.unwrap().is_directory);
        assert!(empty.unwrap().children.is_empty());
    }

    #[test]
    fn test_nonexistent_directory_returns_error() {
        let result = read_directory_tree("/nonexistent/path".into());
        assert!(result.is_err());
    }

    #[test]
    fn test_read_file_contents_success() {
        let dir = setup_test_dir();
        let file_path = dir.path().join("readme.md");
        let contents = read_file_contents(file_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(contents, "# README");
    }

    #[test]
    fn test_read_file_contents_nonexistent() {
        let result = read_file_contents("/nonexistent/file.md".into());
        assert!(result.is_err());
    }

    fn setup_search_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();

        // tmp/
        //   readme.md    -> "# README\nThis is a guide to the project."
        //   notes.md     -> "# Notes\nSome notes about testing.\nAnother line."
        //   .hidden/
        //     secret.md  -> "secret keyword here"
        //   image.png    -> "keyword in non-md file"

        let hidden = dir.path().join(".hidden");
        fs::create_dir_all(&hidden).unwrap();

        fs::write(dir.path().join("readme.md"), "# README\nThis is a guide to the project.").unwrap();
        fs::write(dir.path().join("notes.md"), "# Notes\nSome notes about testing.\nAnother line.").unwrap();
        fs::write(hidden.join("secret.md"), "secret keyword here").unwrap();
        fs::write(dir.path().join("image.png"), "keyword in non-md file").unwrap();

        dir
    }

    #[test]
    fn test_search_files_returns_matching_files_with_line_numbers() {
        let dir = setup_search_dir();
        let results = search_files(dir.path().to_string_lossy().to_string(), "guide".into()).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "readme.md");
        assert_eq!(results[0].matches.len(), 1);
        assert_eq!(results[0].matches[0].line_number, 2);
        assert!(results[0].matches[0].line_content.contains("guide"));
    }

    #[test]
    fn test_search_files_is_case_insensitive() {
        let dir = setup_search_dir();
        let results = search_files(dir.path().to_string_lossy().to_string(), "README".into()).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "readme.md");
    }

    #[test]
    fn test_search_files_returns_empty_when_no_matches() {
        let dir = setup_search_dir();
        let results = search_files(dir.path().to_string_lossy().to_string(), "nonexistent_xyz".into()).unwrap();

        assert!(results.is_empty());
    }

    #[test]
    fn test_search_files_skips_hidden_dirs_and_non_md_files() {
        let dir = setup_search_dir();
        // "keyword" exists in .hidden/secret.md and image.png but not in visible .md files
        let results = search_files(dir.path().to_string_lossy().to_string(), "keyword".into()).unwrap();

        assert!(results.is_empty());
    }

    #[test]
    fn test_write_file_contents_creates_new_file() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("new_file.md");

        write_file_contents(file_path.to_string_lossy().to_string(), "# New File".into()).unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "# New File");
    }

    #[test]
    fn test_write_file_contents_overwrites_existing() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("existing.md");
        fs::write(&file_path, "old content").unwrap();

        write_file_contents(file_path.to_string_lossy().to_string(), "new content".into()).unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "new content");
    }

    #[test]
    fn test_write_file_contents_error_on_invalid_path() {
        let result = write_file_contents("/nonexistent/dir/file.md".into(), "content".into());
        assert!(result.is_err());
    }

    // create_file tests

    #[test]
    fn test_create_file_with_template() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_file(dir.path().to_string_lossy().to_string(), "notes.md".into());

        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.content, "# Notes\n\n");
        let on_disk = fs::read_to_string(dir.path().join("notes.md")).unwrap();
        assert_eq!(on_disk, "# Notes\n\n");
    }

    #[test]
    fn test_create_file_auto_appends_md() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_file(dir.path().to_string_lossy().to_string(), "ideas".into());

        assert!(result.is_ok());
        assert!(dir.path().join("ideas.md").exists());
    }

    #[test]
    fn test_create_file_no_double_md() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_file(dir.path().to_string_lossy().to_string(), "ideas.md".into());

        assert!(result.is_ok());
        // Should NOT create ideas.md.md
        assert!(!dir.path().join("ideas.md.md").exists());
        assert!(dir.path().join("ideas.md").exists());
    }

    #[test]
    fn test_create_file_reject_empty() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_file(dir.path().to_string_lossy().to_string(), "".into());

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_create_file_reject_path_separators() {
        let dir = tempfile::tempdir().unwrap();

        let result = create_file(dir.path().to_string_lossy().to_string(), "../evil.md".into());
        assert!(result.is_err());

        let result = create_file(dir.path().to_string_lossy().to_string(), "sub/file.md".into());
        assert!(result.is_err());

        let result = create_file(dir.path().to_string_lossy().to_string(), "sub\\file.md".into());
        assert!(result.is_err());
    }

    #[test]
    fn test_create_file_reject_existing() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("existing.md"), "already here").unwrap();

        let result = create_file(dir.path().to_string_lossy().to_string(), "existing.md".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_create_file_returns_full_path() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_file(dir.path().to_string_lossy().to_string(), "test.md".into());

        let result = result.unwrap();
        assert!(result.path.ends_with("test.md"));
        assert!(result.path.contains(&dir.path().to_string_lossy().to_string()));
    }

    #[test]
    fn test_create_file_nonexistent_directory() {
        let result = create_file("/nonexistent/dir".into(), "test.md".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    // rename_file tests

    #[test]
    fn test_rename_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        fs::write(&old, "# Old").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "new.md".into());
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.new_path.ends_with("new.md"));
        assert!(!old.exists());
        assert!(dir.path().join("new.md").exists());
    }

    #[test]
    fn test_rename_file_preserves_content() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        fs::write(&old, "# Important Content\n\nSome text here.").unwrap();

        rename_file(old.to_string_lossy().to_string(), "new.md".into()).unwrap();

        let content = fs::read_to_string(dir.path().join("new.md")).unwrap();
        assert_eq!(content, "# Important Content\n\nSome text here.");
    }

    #[test]
    fn test_rename_file_auto_appends_md() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        fs::write(&old, "content").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "new".into()).unwrap();
        assert!(result.new_path.ends_with("new.md"));
        assert!(dir.path().join("new.md").exists());
    }

    #[test]
    fn test_rename_file_no_double_md() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        fs::write(&old, "content").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "new.md".into()).unwrap();
        assert!(result.new_path.ends_with("new.md"));
        assert!(!dir.path().join("new.md.md").exists());
    }

    #[test]
    fn test_rename_file_reject_empty() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        fs::write(&old, "content").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_rename_file_reject_path_separators() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        fs::write(&old, "content").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "../evil.md".into());
        assert!(result.is_err());

        let result = rename_file(old.to_string_lossy().to_string(), "sub/file.md".into());
        assert!(result.is_err());

        let result = rename_file(old.to_string_lossy().to_string(), "sub\\file.md".into());
        assert!(result.is_err());
    }

    #[test]
    fn test_rename_file_nonexistent_source() {
        let result = rename_file("/nonexistent/old.md".into(), "new.md".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_rename_file_existing_target() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        let target = dir.path().join("existing.md");
        fs::write(&old, "old content").unwrap();
        fs::write(&target, "existing content").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "existing.md".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_rename_file_same_name_noop() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("same.md");
        fs::write(&old, "content").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "same.md".into());
        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.old_path, result.new_path);
        assert!(old.exists());
    }

    #[test]
    fn test_rename_file_returns_full_paths() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.md");
        fs::write(&old, "content").unwrap();

        let result = rename_file(old.to_string_lossy().to_string(), "new.md".into()).unwrap();
        assert!(result.old_path.contains(&dir.path().to_string_lossy().to_string()));
        assert!(result.new_path.contains(&dir.path().to_string_lossy().to_string()));
        assert!(result.old_path.ends_with("old.md"));
        assert!(result.new_path.ends_with("new.md"));
    }

    // delete_file tests

    #[test]
    fn test_delete_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("to-delete.md");
        fs::write(&file_path, "# Delete me").unwrap();
        assert!(file_path.exists());

        let result = delete_file(file_path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert!(!file_path.exists());
    }

    #[test]
    fn test_delete_file_nonexistent() {
        let result = delete_file("/nonexistent/file.md".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_delete_file_rejects_non_md() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("readme.txt");
        fs::write(&file_path, "hello").unwrap();

        let result = delete_file(file_path.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("markdown"));
    }

    #[test]
    fn test_delete_file_rejects_directory() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("subdir.md");
        fs::create_dir(&sub).unwrap();

        let result = delete_file(sub.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not directories"));
    }

    #[test]
    fn test_create_file_hyphenated_title() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_file(dir.path().to_string_lossy().to_string(), "my-cool-notes.md".into());

        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.content, "# My Cool Notes\n\n");
        let on_disk = fs::read_to_string(dir.path().join("my-cool-notes.md")).unwrap();
        assert_eq!(on_disk, "# My Cool Notes\n\n");
    }

    // create_directory tests

    #[test]
    fn test_create_directory_success() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_directory(dir.path().to_string_lossy().to_string(), "subfolder".into());

        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with("subfolder"));
        assert!(dir.path().join("subfolder").is_dir());
    }

    #[test]
    fn test_create_directory_trims_whitespace() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_directory(dir.path().to_string_lossy().to_string(), "  notes  ".into());

        assert!(result.is_ok());
        assert!(dir.path().join("notes").is_dir());
    }

    #[test]
    fn test_create_directory_reject_empty() {
        let dir = tempfile::tempdir().unwrap();
        let result = create_directory(dir.path().to_string_lossy().to_string(), "".into());

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_create_directory_reject_path_separators() {
        let dir = tempfile::tempdir().unwrap();

        let result = create_directory(dir.path().to_string_lossy().to_string(), "../evil".into());
        assert!(result.is_err());

        let result = create_directory(dir.path().to_string_lossy().to_string(), "sub/dir".into());
        assert!(result.is_err());

        let result = create_directory(dir.path().to_string_lossy().to_string(), "sub\\dir".into());
        assert!(result.is_err());
    }

    #[test]
    fn test_create_directory_reject_existing() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("existing")).unwrap();

        let result = create_directory(dir.path().to_string_lossy().to_string(), "existing".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_create_directory_nonexistent_parent() {
        let result = create_directory("/nonexistent/dir".into(), "test".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    // move_file tests

    #[test]
    fn test_move_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(&file, "# Test").unwrap();
        let subdir = dir.path().join("sub");
        fs::create_dir(&subdir).unwrap();

        let result = move_file(
            file.to_string_lossy().to_string(),
            subdir.to_string_lossy().to_string(),
        );
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.new_path.ends_with("test.md"));
        assert!(!file.exists());
        assert!(subdir.join("test.md").exists());
        assert_eq!(fs::read_to_string(subdir.join("test.md")).unwrap(), "# Test");
    }

    #[test]
    fn test_move_file_returns_correct_paths() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("doc.md");
        fs::write(&file, "content").unwrap();
        let subdir = dir.path().join("target");
        fs::create_dir(&subdir).unwrap();

        let result = move_file(
            file.to_string_lossy().to_string(),
            subdir.to_string_lossy().to_string(),
        ).unwrap();
        assert!(result.old_path.ends_with("doc.md"));
        assert!(result.new_path.ends_with("doc.md"));
        assert!(result.new_path.contains("target"));
    }

    #[test]
    fn test_move_file_reject_nonexistent_source() {
        let dir = tempfile::tempdir().unwrap();
        let subdir = dir.path().join("sub");
        fs::create_dir(&subdir).unwrap();

        let result = move_file("/nonexistent/file.md".into(), subdir.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_move_file_reject_non_md() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("readme.txt");
        fs::write(&file, "hello").unwrap();
        let subdir = dir.path().join("sub");
        fs::create_dir(&subdir).unwrap();

        let result = move_file(file.to_string_lossy().to_string(), subdir.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("markdown"));
    }

    #[test]
    fn test_move_file_reject_nonexistent_target() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(&file, "content").unwrap();

        let result = move_file(file.to_string_lossy().to_string(), "/nonexistent/dir".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_move_file_reject_name_collision() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(&file, "content").unwrap();
        let subdir = dir.path().join("sub");
        fs::create_dir(&subdir).unwrap();
        fs::write(subdir.join("test.md"), "existing").unwrap();

        let result = move_file(file.to_string_lossy().to_string(), subdir.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_move_file_reject_directory_source() {
        let dir = tempfile::tempdir().unwrap();
        let subdir = dir.path().join("source.md");
        fs::create_dir(&subdir).unwrap();
        let target = dir.path().join("target");
        fs::create_dir(&target).unwrap();

        let result = move_file(subdir.to_string_lossy().to_string(), target.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not directories"));
    }

    // delete_directory tests

    #[test]
    fn test_delete_directory_empty() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("empty-folder");
        fs::create_dir(&sub).unwrap();
        assert!(sub.exists());

        let result = delete_directory(sub.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert!(!sub.exists());
    }

    #[test]
    fn test_delete_directory_with_contents() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("folder");
        let nested = sub.join("nested");
        fs::create_dir_all(&nested).unwrap();
        fs::write(sub.join("file.md"), "# File").unwrap();
        fs::write(nested.join("deep.md"), "# Deep").unwrap();

        let result = delete_directory(sub.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert!(!sub.exists());
    }

    #[test]
    fn test_delete_directory_nonexistent() {
        let result = delete_directory("/nonexistent/folder".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_delete_directory_rejects_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.md");
        fs::write(&file, "content").unwrap();

        let result = delete_directory(file.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not files"));
    }

    // move_directory tests

    #[test]
    fn test_move_directory_success() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source-folder");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("file.md"), "# File").unwrap();
        let target = dir.path().join("target-folder");
        fs::create_dir(&target).unwrap();

        let result = move_directory(
            source.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
        );
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.new_path.contains("target-folder"));
        assert!(result.new_path.ends_with("source-folder"));
        assert!(!source.exists());
        assert!(target.join("source-folder").exists());
        assert!(target.join("source-folder").join("file.md").exists());
    }

    #[test]
    fn test_move_directory_nonexistent_source() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("target");
        fs::create_dir(&target).unwrap();

        let result = move_directory("/nonexistent/dir".into(), target.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_move_directory_rejects_file_source() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.md");
        fs::write(&file, "content").unwrap();
        let target = dir.path().join("target");
        fs::create_dir(&target).unwrap();

        let result = move_directory(file.to_string_lossy().to_string(), target.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a directory"));
    }

    #[test]
    fn test_move_directory_nonexistent_target() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        fs::create_dir(&source).unwrap();

        let result = move_directory(source.to_string_lossy().to_string(), "/nonexistent/dir".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_move_directory_name_collision() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("folder");
        fs::create_dir(&source).unwrap();
        let target = dir.path().join("target");
        fs::create_dir(&target).unwrap();
        // Create a same-named dir inside target
        fs::create_dir(target.join("folder")).unwrap();

        let result = move_directory(source.to_string_lossy().to_string(), target.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_move_directory_rejects_move_into_self_or_descendant() {
        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().join("parent");
        let child = parent.join("child");
        fs::create_dir_all(&child).unwrap();

        // Try to move parent into child (descendant) — should fail
        let result = move_directory(
            parent.to_string_lossy().to_string(),
            child.to_string_lossy().to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot move a directory into itself"));
    }

    #[test]
    fn test_delete_directory_rejects_path_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("folder");
        fs::create_dir(&sub).unwrap();

        // Construct a path with .. in it
        let evil_path = format!("{}/../folder", sub.to_string_lossy());
        let result = delete_directory(evil_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid"));
    }

    // read_directory_files tests

    #[test]
    fn test_read_directory_files_returns_all_files() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(dir.path().join("readme.md"), "# README").unwrap();
        fs::write(sub.join("note.md"), "# Note").unwrap();

        let result = read_directory_files(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(result.len(), 2);

        let paths: Vec<&str> = result.iter().map(|f| f.relative_path.as_str()).collect();
        assert!(paths.iter().any(|p| p.ends_with("readme.md")));
        assert!(paths.iter().any(|p| p.contains("sub") && p.ends_with("note.md")));
    }

    #[test]
    fn test_read_directory_files_skips_hidden() {
        let dir = tempfile::tempdir().unwrap();
        let hidden = dir.path().join(".hidden");
        fs::create_dir(&hidden).unwrap();
        fs::write(hidden.join("secret.md"), "secret").unwrap();
        fs::write(dir.path().join("visible.md"), "visible").unwrap();

        let result = read_directory_files(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].relative_path, "visible.md");
    }

    #[test]
    fn test_read_directory_files_nonexistent() {
        let result = read_directory_files("/nonexistent/dir".into());
        assert!(result.is_err());
    }

    #[test]
    fn test_read_directory_files_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let result = read_directory_files(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(result.is_empty());
    }

    // restore_directory_files tests

    #[test]
    fn test_restore_directory_files_creates_files() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("restored");

        let files = vec![
            crate::models::DirectoryFileContent {
                relative_path: "readme.md".into(),
                content: "# README".into(),
            },
            crate::models::DirectoryFileContent {
                relative_path: "sub/note.md".into(),
                content: "# Note".into(),
            },
        ];

        let result = restore_directory_files(base.to_string_lossy().to_string(), files);
        assert!(result.is_ok());
        assert_eq!(fs::read_to_string(base.join("readme.md")).unwrap(), "# README");
        assert_eq!(fs::read_to_string(base.join("sub/note.md")).unwrap(), "# Note");
    }

    #[test]
    fn test_restore_directory_files_creates_base_dir() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("new-folder");

        let files = vec![
            crate::models::DirectoryFileContent {
                relative_path: "file.md".into(),
                content: "content".into(),
            },
        ];

        assert!(!base.exists());
        let result = restore_directory_files(base.to_string_lossy().to_string(), files);
        assert!(result.is_ok());
        assert!(base.exists());
        assert!(base.join("file.md").exists());
    }

    #[test]
    fn test_restore_directory_files_empty_list() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("empty-restore");

        let result = restore_directory_files(base.to_string_lossy().to_string(), vec![]);
        assert!(result.is_ok());
        assert!(base.exists());
    }

    #[test]
    fn test_read_then_restore_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        let sub = source.join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(source.join("root.md"), "# Root").unwrap();
        fs::write(sub.join("nested.md"), "# Nested").unwrap();

        // Read
        let files = read_directory_files(source.to_string_lossy().to_string()).unwrap();
        assert_eq!(files.len(), 2);

        // Restore to a new location
        let dest = dir.path().join("restored");
        let result = restore_directory_files(dest.to_string_lossy().to_string(), files);
        assert!(result.is_ok());

        assert_eq!(fs::read_to_string(dest.join("root.md")).unwrap(), "# Root");
        assert_eq!(fs::read_to_string(dest.join("sub/nested.md")).unwrap(), "# Nested");
    }

    fn setup_backlinks_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let hidden = dir.path().join(".hidden");
        fs::create_dir_all(&hidden).unwrap();

        fs::write(dir.path().join("notes.md"), "# Notes\nSome notes here.").unwrap();
        fs::write(dir.path().join("index.md"), "# Index\nSee [[notes]] for details.\nAlso [[other]].").unwrap();
        fs::write(dir.path().join("guide.md"), "# Guide\nRefer to [[notes.md|my notes]] here.").unwrap();
        fs::write(dir.path().join("unrelated.md"), "# Unrelated\nNo links here.").unwrap();
        fs::write(hidden.join("hidden.md"), "# Hidden\nSee [[notes]].").unwrap();

        dir
    }

    #[test]
    fn test_find_backlinks_matches_basic_and_aliased() {
        let dir = setup_backlinks_dir();
        let results = find_backlinks(dir.path().to_string_lossy().to_string(), "notes.md".into()).unwrap();

        assert_eq!(results.len(), 2);
        let names: Vec<&str> = results.iter().map(|r| r.name.as_str()).collect();
        assert!(names.contains(&"guide.md"));
        assert!(names.contains(&"index.md"));
    }

    #[test]
    fn test_find_backlinks_skips_self() {
        let dir = setup_backlinks_dir();
        let results = find_backlinks(dir.path().to_string_lossy().to_string(), "notes.md".into()).unwrap();

        let names: Vec<&str> = results.iter().map(|r| r.name.as_str()).collect();
        assert!(!names.contains(&"notes.md"));
    }

    #[test]
    fn test_find_backlinks_skips_hidden_dirs() {
        let dir = setup_backlinks_dir();
        let results = find_backlinks(dir.path().to_string_lossy().to_string(), "notes.md".into()).unwrap();

        let names: Vec<&str> = results.iter().map(|r| r.name.as_str()).collect();
        assert!(!names.contains(&"hidden.md"));
    }

    #[test]
    fn test_find_backlinks_returns_empty_for_no_matches() {
        let dir = setup_backlinks_dir();
        let results = find_backlinks(dir.path().to_string_lossy().to_string(), "unrelated.md".into()).unwrap();

        assert!(results.is_empty());
    }

    #[test]
    fn test_find_backlinks_matches_without_md_extension() {
        let dir = setup_backlinks_dir();
        let results = find_backlinks(dir.path().to_string_lossy().to_string(), "notes".into()).unwrap();

        assert_eq!(results.len(), 2);
    }

    // save_image tests

    #[test]
    fn test_save_image_creates_assets_dir() {
        let dir = tempfile::tempdir().unwrap();
        let data = vec![0x89, 0x50, 0x4E, 0x47]; // PNG magic bytes

        let result = save_image(dir.path().to_string_lossy().to_string(), "test.png".into(), data);
        assert!(result.is_ok());
        assert!(dir.path().join("assets").is_dir());
        assert!(dir.path().join("assets").join("test.png").exists());
    }

    #[test]
    fn test_save_image_writes_binary_data() {
        let dir = tempfile::tempdir().unwrap();
        let data = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];

        save_image(dir.path().to_string_lossy().to_string(), "photo.jpg".into(), data.clone()).unwrap();

        let written = fs::read(dir.path().join("assets").join("photo.jpg")).unwrap();
        assert_eq!(written, data);
    }

    #[test]
    fn test_save_image_rejects_invalid_extension() {
        let dir = tempfile::tempdir().unwrap();
        let data = vec![0x00];

        let result = save_image(dir.path().to_string_lossy().to_string(), "evil.exe".into(), data.clone());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported"));

        let result = save_image(dir.path().to_string_lossy().to_string(), "script.js".into(), data);
        assert!(result.is_err());
    }

    #[test]
    fn test_save_image_rejects_path_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let data = vec![0x00];

        let result = save_image(dir.path().to_string_lossy().to_string(), "../evil.png".into(), data.clone());
        assert!(result.is_err());

        let result = save_image(dir.path().to_string_lossy().to_string(), "sub/evil.png".into(), data.clone());
        assert!(result.is_err());

        let result = save_image(dir.path().to_string_lossy().to_string(), "sub\\evil.png".into(), data);
        assert!(result.is_err());
    }

    #[test]
    fn test_save_image_rejects_empty_filename() {
        let dir = tempfile::tempdir().unwrap();
        let data = vec![0x00];

        let result = save_image(dir.path().to_string_lossy().to_string(), "".into(), data);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_save_image_accepts_all_supported_formats() {
        let dir = tempfile::tempdir().unwrap();
        let data = vec![0x00, 0x01];

        for ext in &["png", "jpg", "jpeg", "gif", "webp"] {
            let filename = format!("test.{}", ext);
            let result = save_image(dir.path().to_string_lossy().to_string(), filename, data.clone());
            assert!(result.is_ok(), "Should accept .{} files", ext);
        }
    }
}
