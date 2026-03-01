mod commands;
mod models;

use commands::watcher::WatcherState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
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
            commands::watcher::start_watching,
            commands::diagram::render_ascii_diagram,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
