use std::collections::HashSet;
use std::path::Path;

/// Filters folder list: removes duplicates, non-existent dirs, caps at `max`.
/// Preserves insertion order (most recent first).
pub fn build_recent_folders(folders: &[String], max: usize) -> Vec<String> {
    let mut seen = HashSet::new();
    folders
        .iter()
        .filter(|p| {
            let path = Path::new(p.as_str());
            path.is_dir() && seen.insert((*p).clone())
        })
        .take(max)
        .cloned()
        .collect()
}

/// Updates the Windows taskbar jump list with a "Recent Folders" category.
/// Each folder becomes a shell link that re-launches the app with that folder as argument.
#[cfg(windows)]
pub fn set_jump_list(folders: &[String], exe_path: &str) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW, ShellLink,
    };
    use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};

    unsafe {
        // Initialize COM
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| format!("CoInitializeEx failed: {}", e))?;

        let result = (|| -> Result<(), String> {
            // Create the destination list
            let dest_list: ICustomDestinationList =
                CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)
                    .map_err(|e| format!("Failed to create DestinationList: {}", e))?;

            // Begin building the list
            let mut max_slots: u32 = 0;
            let _removed: IObjectArray = dest_list
                .BeginList(&mut max_slots)
                .map_err(|e| format!("BeginList failed: {}", e))?;

            // Create a collection for our items
            let collection: IObjectCollection =
                CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)
                    .map_err(|e| format!("Failed to create collection: {}", e))?;

            // Add each folder as a shell link
            let limit = (max_slots as usize).min(folders.len());
            for folder in folders.iter().take(limit) {
                let link: IShellLinkW =
                    CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
                        .map_err(|e| format!("Failed to create ShellLink: {}", e))?;

                // Set target to our exe
                link.SetPath(&HSTRING::from(exe_path))
                    .map_err(|e| format!("SetPath failed: {}", e))?;

                // Set argument to the folder path (quoted for spaces)
                let arg = format!("--open-folder \"{}\"", folder);
                link.SetArguments(&HSTRING::from(arg.as_str()))
                    .map_err(|e| format!("SetArguments failed: {}", e))?;

                // Set display name to just the folder name
                let display = Path::new(folder)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| folder.clone());
                link.SetDescription(&HSTRING::from(display.as_str()))
                    .map_err(|e| format!("SetDescription failed: {}", e))?;

                // Set icon to a folder icon (shell32.dll index 3)
                link.SetIconLocation(&HSTRING::from("shell32.dll"), 3)
                    .map_err(|e| format!("SetIconLocation failed: {}", e))?;

                collection
                    .AddObject(&link)
                    .map_err(|e| format!("AddObject failed: {}", e))?;
            }

            // Cast collection to IObjectArray for AppendCategory
            let array: IObjectArray = windows::core::Interface::cast(&collection)
                .map_err(|e| format!("Cast to IObjectArray failed: {}", e))?;

            dest_list
                .AppendCategory(&HSTRING::from("Recent Folders"), &array)
                .map_err(|e| format!("AppendCategory failed: {}", e))?;

            dest_list
                .CommitList()
                .map_err(|e| format!("CommitList failed: {}", e))?;

            Ok(())
        })();

        CoUninitialize();
        result
    }
}

#[cfg(not(windows))]
pub fn set_jump_list(_folders: &[String], _exe_path: &str) -> Result<(), String> {
    Ok(()) // no-op on non-Windows
}

/// Tauri command: receives folder list from frontend, validates, and updates jump list.
#[tauri::command]
pub fn update_jump_list(folders: Vec<String>) -> Result<(), String> {
    let valid = build_recent_folders(&folders, 10);
    if valid.is_empty() {
        return Ok(());
    }
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    set_jump_list(&valid, &exe)
}

/// Tauri command: clears the jump list.
#[tauri::command]
pub fn clear_jump_list() -> Result<(), String> {
    set_jump_list(&[], "")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_build_recent_folders_deduplicates() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();

        let folders = vec![path.clone(), path.clone(), path.clone()];
        let result = build_recent_folders(&folders, 10);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], path);
    }

    #[test]
    fn test_build_recent_folders_limits_to_max() {
        // Create 15 temp directories
        let dirs: Vec<_> = (0..15).map(|_| tempfile::tempdir().unwrap()).collect();
        let folders: Vec<String> = dirs
            .iter()
            .map(|d| d.path().to_string_lossy().to_string())
            .collect();

        let result = build_recent_folders(&folders, 10);

        assert_eq!(result.len(), 10);
    }

    #[test]
    fn test_build_recent_folders_filters_nonexistent() {
        let dir = tempfile::tempdir().unwrap();
        let valid_path = dir.path().to_string_lossy().to_string();

        let folders = vec![
            "C:\\nonexistent\\fake\\path".to_string(),
            valid_path.clone(),
            "Z:\\also\\not\\real".to_string(),
        ];
        let result = build_recent_folders(&folders, 10);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], valid_path);
    }

    #[test]
    fn test_build_recent_folders_preserves_order() {
        let dir1 = tempfile::tempdir().unwrap();
        let dir2 = tempfile::tempdir().unwrap();
        let dir3 = tempfile::tempdir().unwrap();

        let path1 = dir1.path().to_string_lossy().to_string();
        let path2 = dir2.path().to_string_lossy().to_string();
        let path3 = dir3.path().to_string_lossy().to_string();

        let folders = vec![path1.clone(), path2.clone(), path3.clone()];
        let result = build_recent_folders(&folders, 10);

        assert_eq!(result, vec![path1, path2, path3]);
    }

    #[test]
    fn test_build_recent_folders_empty_input() {
        let result = build_recent_folders(&[], 10);
        assert!(result.is_empty());
    }

    #[test]
    fn test_build_recent_folders_filters_files_not_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("not-a-dir.txt");
        fs::write(&file_path, "hello").unwrap();

        let folders = vec![file_path.to_string_lossy().to_string()];
        let result = build_recent_folders(&folders, 10);

        assert!(result.is_empty());
    }
}
