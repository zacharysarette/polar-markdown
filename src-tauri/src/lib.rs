mod commands;
mod models;

use commands::watcher::WatcherState;
use std::path::Path;
use std::sync::Mutex;

/// Holds the file path passed via CLI args (if any). `.take()` ensures it's consumed once.
pub struct InitialFileState(pub Mutex<Option<String>>);

/// Extracts a .md file path from CLI arguments.
/// Skips the first arg (exe path) and any flags starting with `-`.
/// Returns the first arg that is an existing .md file, canonicalized to an absolute path.
fn extract_file_arg(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1) // skip exe path
        .filter(|a| !a.starts_with('-'))
        .find_map(|a| {
            let path = Path::new(a);
            if path.exists()
                && path.is_file()
                && a.to_lowercase().ends_with(".md")
            {
                path.canonicalize().ok().map(|p| {
                    let s = p.to_string_lossy().to_string();
                    // Strip Windows UNC prefix \\?\
                    s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
                })
            } else {
                None
            }
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .manage(InitialFileState(Mutex::new(None)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Second instance launched — extract file arg and emit event to existing window
            if let Some(file_path) = extract_file_arg(&args) {
                let _ = tauri::Emitter::emit(app, "open-file", file_path);
            }
            // Focus the existing main window
            if let Some(window) = tauri::Manager::get_webview_window(app, "main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Parse CLI args for an initial file to open
            let args: Vec<String> = std::env::args().collect();
            if let Some(file_path) = extract_file_arg(&args) {
                let state = tauri::Manager::state::<InitialFileState>(app);
                if let Ok(mut guard) = state.0.lock() {
                    *guard = Some(file_path);
                };
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::filesystem::read_directory_tree,
            commands::filesystem::read_file_contents,
            commands::filesystem::write_file_contents,
            commands::filesystem::get_docs_path,
            commands::filesystem::get_help_content,
            commands::filesystem::search_files,
            commands::filesystem::create_file,
            commands::filesystem::rename_file,
            commands::filesystem::delete_file,
            commands::filesystem::get_initial_file,
            commands::watcher::start_watching,
            commands::diagram::render_ascii_diagram,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_extract_file_arg_finds_md_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(&file, "# Test").unwrap();

        let args = vec![
            "polarmd.exe".to_string(),
            file.to_string_lossy().to_string(),
        ];
        let result = extract_file_arg(&args);
        assert!(result.is_some());
        assert!(result.unwrap().ends_with("test.md"));
    }

    #[test]
    fn test_extract_file_arg_skips_flags() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(&file, "# Test").unwrap();

        let args = vec![
            "polarmd.exe".to_string(),
            "--verbose".to_string(),
            "-d".to_string(),
            file.to_string_lossy().to_string(),
        ];
        let result = extract_file_arg(&args);
        assert!(result.is_some());
        assert!(result.unwrap().ends_with("test.md"));
    }

    #[test]
    fn test_extract_file_arg_returns_none_for_no_args() {
        let args = vec!["polarmd.exe".to_string()];
        let result = extract_file_arg(&args);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_file_arg_ignores_nonexistent_files() {
        let args = vec![
            "polarmd.exe".to_string(),
            "C:\\nonexistent\\fake.md".to_string(),
        ];
        let result = extract_file_arg(&args);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_file_arg_ignores_non_md_files() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("readme.txt");
        fs::write(&file, "hello").unwrap();

        let args = vec![
            "polarmd.exe".to_string(),
            file.to_string_lossy().to_string(),
        ];
        let result = extract_file_arg(&args);
        assert!(result.is_none());
    }
}
