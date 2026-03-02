use crate::models::{CreateFileResult, FileEntry, RenameFileResult, SearchMatch, SearchResult};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

/// Help file content embedded at compile time — always available regardless of install location.
const HELP_CONTENT: &str = include_str!("../../../docs/How to Use Polar Markdown.md");

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

        let modified = fs::metadata(&path)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        if path.is_dir() {
            let children = build_tree(&path);
            // Only include directories that contain .md files (directly or nested)
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_directory: true,
                    children,
                    modified,
                });
            }
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
    fs::remove_file(file).map_err(|e| format!("Failed to delete file: {}", e))
}

/// Returns the file path passed via CLI args (if any), consuming it so subsequent calls return None.
#[tauri::command]
pub fn get_initial_file(state: tauri::State<'_, crate::InitialFileState>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

/// Returns the embedded help file content (compiled into the binary).
#[tauri::command]
pub fn get_help_content() -> String {
    HELP_CONTENT.to_string()
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
}
