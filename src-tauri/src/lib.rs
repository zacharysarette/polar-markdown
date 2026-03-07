mod commands;
mod models;

use commands::watcher::WatcherState;
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

/// Holds the file path passed via CLI args (if any). `.take()` ensures it's consumed once.
pub struct InitialFileState(pub Mutex<Option<String>>);

/// Holds a folder path passed via `--open-folder` CLI arg (from jump list). Consumed once.
pub struct InitialFolderState(pub Mutex<Option<String>>);

/// Atomic counter for generating unique window labels ("glacimark-2", "glacimark-3", ...).
pub struct WindowCounter(pub AtomicU32);

/// Generates a unique window label like "glacimark-2", "glacimark-3", etc.
fn generate_window_label(counter: &WindowCounter) -> String {
    let id = counter.0.fetch_add(1, Ordering::SeqCst);
    format!("glacimark-{}", id)
}

/// Reads the saved theme from the app data directory (written by the frontend).
fn read_saved_theme(app: &tauri::App) -> Option<String> {
    let dir = tauri::Manager::path(app).app_data_dir().ok()?;
    let path = dir.join("theme.txt");
    std::fs::read_to_string(path).ok().map(|s| s.trim().to_string())
}

/// Reads the saved theme using an AppHandle (for use outside setup).
fn read_saved_theme_from_handle(app: &tauri::AppHandle) -> Option<String> {
    let dir = tauri::Manager::path(app).app_data_dir().ok()?;
    let path = dir.join("theme.txt");
    std::fs::read_to_string(path).ok().map(|s| s.trim().to_string())
}

/// Creates a new Glacimark window with the correct theme background.
fn create_glacimark_window(app: &tauri::AppHandle) -> Result<(), String> {
    let counter = tauri::Manager::state::<WindowCounter>(app);
    let label = generate_window_label(&counter);

    let color = match read_saved_theme_from_handle(app) {
        Some(t) if t == "glacier" => tauri::webview::Color(0xf4, 0xf7, 0xfb, 0xff),
        _ => tauri::webview::Color(0x1a, 0x1b, 0x26, 0xff),
    };

    let window = tauri::webview::WebviewWindowBuilder::new(
        app,
        &label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Glacimark")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .visible(false)
    .build()
    .map_err(|e| e.to_string())?;

    let _ = window.set_background_color(Some(color));
    let _ = window.show();
    Ok(())
}

/// Finds the focused window's label, falling back to "main" or any window.
fn find_focused_window_label(app: &tauri::AppHandle) -> Option<String> {
    let windows = tauri::Manager::webview_windows(app);
    for (label, window) in &windows {
        if window.is_focused().unwrap_or(false) {
            return Some(label.clone());
        }
    }
    if windows.contains_key("main") {
        return Some("main".to_string());
    }
    windows.keys().next().cloned()
}

/// Tauri command: creates a new window.
#[tauri::command]
fn create_new_window(app: tauri::AppHandle) -> Result<(), String> {
    create_glacimark_window(&app)
}

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

/// Checks if `--new-window` flag is present in CLI args.
fn has_new_window_flag(args: &[String]) -> bool {
    args.iter().any(|a| a == "--new-window")
}

/// Extracts a folder path from `--open-folder "path"` CLI arguments.
/// Used when the app is launched from a jump list entry.
fn extract_folder_arg(args: &[String]) -> Option<String> {
    let mut iter = args.iter().skip(1);
    while let Some(arg) = iter.next() {
        if arg == "--open-folder" {
            if let Some(folder) = iter.next() {
                let path = Path::new(folder);
                if path.exists() && path.is_dir() {
                    return path.canonicalize().ok().map(|p| {
                        let s = p.to_string_lossy().to_string();
                        s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
                    });
                }
            }
            return None;
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .manage(InitialFileState(Mutex::new(None)))
        .manage(InitialFolderState(Mutex::new(None)))
        .manage(WindowCounter(AtomicU32::new(2)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Second instance launched — check for new-window, folder, file, or default
            if has_new_window_flag(&args) {
                let _ = create_glacimark_window(app);
                return;
            }
            if let Some(folder_path) = extract_folder_arg(&args) {
                if let Some(label) = find_focused_window_label(app) {
                    let target = tauri::EventTarget::webview_window(&label);
                    let _ = tauri::Emitter::emit_to(app, target, "open-folder", folder_path);
                    if let Some(window) = tauri::Manager::get_webview_window(app, &label) {
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            } else if let Some(file_path) = extract_file_arg(&args) {
                if let Some(label) = find_focused_window_label(app) {
                    let target = tauri::EventTarget::webview_window(&label);
                    let _ = tauri::Emitter::emit_to(app, target, "open-file", file_path);
                    if let Some(window) = tauri::Manager::get_webview_window(app, &label) {
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            } else {
                // No file/folder arg (taskbar click, Start menu, etc.): new window
                let _ = create_glacimark_window(app);
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

            // Parse CLI args for an initial file or folder to open
            let args: Vec<String> = std::env::args().collect();
            if let Some(folder_path) = extract_folder_arg(&args) {
                let state = tauri::Manager::state::<InitialFolderState>(app);
                if let Ok(mut guard) = state.0.lock() {
                    *guard = Some(folder_path);
                };
            } else if let Some(file_path) = extract_file_arg(&args) {
                let state = tauri::Manager::state::<InitialFileState>(app);
                if let Ok(mut guard) = state.0.lock() {
                    *guard = Some(file_path);
                };
            }

            // Application menus
            let file_menu = tauri::menu::SubmenuBuilder::new(app, "File")
                .item(&tauri::menu::MenuItem::with_id(app, "new-file", "New File", true, Some("CmdOrCtrl+N"))?)
                .item(&tauri::menu::MenuItem::with_id(app, "new-window", "New Window", true, Some("CmdOrCtrl+Shift+N"))?)
                .separator()
                .item(&tauri::menu::MenuItem::with_id(app, "open-folder", "Open Folder...", true, None::<&str>)?)
                .separator()
                .item(&tauri::menu::MenuItem::with_id(app, "save-as", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?)
                .item(&tauri::menu::MenuItem::with_id(app, "close-pane", "Close Pane", true, Some("CmdOrCtrl+W"))?)
                .build()?;
            let view_menu = tauri::menu::SubmenuBuilder::new(app, "View")
                .item(&tauri::menu::MenuItem::with_id(app, "toggle-edit", "Toggle Edit Mode", true, Some("CmdOrCtrl+E"))?)
                .separator()
                .item(&tauri::menu::MenuItem::with_id(app, "toggle-fullscreen", "Toggle Fullscreen", true, Some("Alt+Enter"))?)
                .build()?;
            let help_menu = tauri::menu::SubmenuBuilder::new(app, "Help")
                .item(&tauri::menu::MenuItem::with_id(app, "help", "Help", true, None::<&str>)?)
                .build()?;
            let menu = tauri::menu::MenuBuilder::new(app)
                .item(&file_menu)
                .item(&view_menu)
                .item(&help_menu)
                .build()?;
            app.set_menu(menu)?;

            // Handle menu events: new-window in Rust, everything else forwarded to focused window
            let handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                let id = event.id().0.as_str();
                if id == "new-window" {
                    let _ = create_glacimark_window(&handle);
                } else if let Some(label) = find_focused_window_label(&handle) {
                    let target = tauri::EventTarget::webview_window(label);
                    let _ = tauri::Emitter::emit_to(&handle, target, &format!("menu-{}", id), ());
                }
            });

            // Set native window background color to match saved theme, then show.
            // Window starts hidden (tauri.conf.json visible:false) so the user
            // never sees the wrong color — we paint the right one before showing.
            // Try "main" first (Tauri default label), then fall back to any window.
            let window = tauri::Manager::get_webview_window(app, "main")
                .or_else(|| {
                    tauri::Manager::webview_windows(app)
                        .into_values()
                        .next()
                });
            if let Some(window) = window {
                let color = match read_saved_theme(app) {
                    Some(t) if t == "glacier" => tauri::webview::Color(0xf4, 0xf7, 0xfb, 0xff),
                    _ => tauri::webview::Color(0x1a, 0x1b, 0x26, 0xff),
                };
                let _ = window.set_background_color(Some(color));
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::filesystem::read_directory_tree,
            commands::filesystem::read_file_contents,
            commands::filesystem::write_file_contents,
            commands::filesystem::get_docs_path,
            commands::filesystem::get_help_content,
            commands::filesystem::get_museum_content,
            commands::filesystem::search_files,
            commands::filesystem::find_backlinks,
            commands::filesystem::create_file,
            commands::filesystem::rename_file,
            commands::filesystem::delete_file,
            commands::filesystem::delete_directory,
            commands::filesystem::create_directory,
            commands::filesystem::move_file,
            commands::filesystem::move_directory,
            commands::filesystem::read_directory_files,
            commands::filesystem::restore_directory_files,
            commands::filesystem::get_initial_file,
            commands::filesystem::save_image,
            commands::filesystem::save_theme,
            commands::filesystem::get_initial_folder,
            commands::watcher::start_watching,
            commands::diagram::render_ascii_diagram,
            commands::jumplist::update_jump_list,
            commands::jumplist::clear_jump_list,
            create_new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::AtomicU32;

    #[test]
    fn test_generate_window_label_starts_at_2() {
        let counter = WindowCounter(AtomicU32::new(2));
        let label = generate_window_label(&counter);
        assert_eq!(label, "glacimark-2");
    }

    #[test]
    fn test_generate_window_label_increments() {
        let counter = WindowCounter(AtomicU32::new(2));
        assert_eq!(generate_window_label(&counter), "glacimark-2");
        assert_eq!(generate_window_label(&counter), "glacimark-3");
        assert_eq!(generate_window_label(&counter), "glacimark-4");
    }

    #[test]
    fn test_window_counter_is_thread_safe() {
        use std::collections::HashSet;
        use std::sync::Arc;

        let counter = Arc::new(WindowCounter(AtomicU32::new(2)));
        let mut handles = vec![];

        for _ in 0..5 {
            let c = Arc::clone(&counter);
            handles.push(std::thread::spawn(move || generate_window_label(&c)));
        }

        let labels: HashSet<String> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        assert_eq!(labels.len(), 5, "All labels should be unique");
    }

    #[test]
    fn test_extract_file_arg_finds_md_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(&file, "# Test").unwrap();

        let args = vec![
            "glacimark.exe".to_string(),
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
            "glacimark.exe".to_string(),
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
        let args = vec!["glacimark.exe".to_string()];
        let result = extract_file_arg(&args);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_file_arg_ignores_nonexistent_files() {
        let args = vec![
            "glacimark.exe".to_string(),
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
            "glacimark.exe".to_string(),
            file.to_string_lossy().to_string(),
        ];
        let result = extract_file_arg(&args);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_folder_arg_finds_folder() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();

        let args = vec![
            "glacimark.exe".to_string(),
            "--open-folder".to_string(),
            path.clone(),
        ];
        let result = extract_folder_arg(&args);
        assert!(result.is_some());
    }

    #[test]
    fn test_extract_folder_arg_returns_none_without_flag() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();

        let args = vec![
            "glacimark.exe".to_string(),
            path,
        ];
        let result = extract_folder_arg(&args);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_folder_arg_returns_none_for_nonexistent() {
        let args = vec![
            "glacimark.exe".to_string(),
            "--open-folder".to_string(),
            "C:\\nonexistent\\fake\\path".to_string(),
        ];
        let result = extract_folder_arg(&args);
        assert!(result.is_none());
    }

    #[test]
    fn test_has_new_window_flag_true() {
        let args = vec!["glacimark.exe".to_string(), "--new-window".to_string()];
        assert!(has_new_window_flag(&args));
    }

    #[test]
    fn test_has_new_window_flag_false() {
        let args = vec!["glacimark.exe".to_string()];
        assert!(!has_new_window_flag(&args));
    }

    #[test]
    fn test_has_new_window_flag_with_other_args() {
        let args = vec![
            "glacimark.exe".to_string(),
            "--verbose".to_string(),
            "--new-window".to_string(),
            "--debug".to_string(),
        ];
        assert!(has_new_window_flag(&args));
    }

    #[test]
    fn test_extract_folder_arg_returns_none_for_file_not_dir() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.txt");
        fs::write(&file, "hello").unwrap();

        let args = vec![
            "glacimark.exe".to_string(),
            "--open-folder".to_string(),
            file.to_string_lossy().to_string(),
        ];
        let result = extract_folder_arg(&args);
        assert!(result.is_none());
    }
}
