use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
pub fn start_watching(app_handle: AppHandle, path: String) -> Result<(), String> {
    let state = app_handle.state::<WatcherState>();
    let mut watcher_guard = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock watcher state: {}", e))?;

    // Drop existing watcher if any
    *watcher_guard = None;

    let handle = app_handle.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            if let Ok(event) = result {
                // Only emit for modify/create/remove events
                use notify::EventKind;
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {
                        let paths: Vec<String> = event
                            .paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();
                        let _ = handle.emit("file-changed", paths);
                    }
                    _ => {}
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path {}: {}", path, e))?;

    *watcher_guard = Some(watcher);

    Ok(())
}

#[cfg(test)]
mod tests {
    // Watcher tests require the Tauri runtime, so we test the structural aspects
    use super::*;

    #[test]
    fn test_watcher_state_default_is_none() {
        let state = WatcherState(Mutex::new(None));
        let guard = state.0.lock().unwrap();
        assert!(guard.is_none());
    }
}
