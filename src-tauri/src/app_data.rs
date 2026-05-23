//! App data inventory for installed software.
//!
//! Distinct from `cleanup.rs`: that module surfaces *orphan* folders whose
//! owning app is gone. This one surfaces folders that *match* a currently
//! installed app, so users can prune the data of software they still have but
//! no longer use. Deletion routes through the same Recycle-Bin-only guard.

use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::cleanup::{delete_path, entry_size, env_dir, tokens};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppDataEntry {
    pub id: String,
    /// Display name of the installed app this folder appears to belong to.
    pub related_to: String,
    /// "AppData" | "LocalAppData" | "ProgramData".
    pub location: String,
    pub path: String,
    pub size_bytes: u64,
    /// Last-modified time as Unix seconds, or null when unreadable. The UI
    /// formats this so we don't pull in a date crate just for display.
    pub last_modified_unix: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDataDeleteReport {
    pub deleted_paths: Vec<String>,
    pub errors: Vec<String>,
}

fn read_modified_unix(path: &std::path::Path) -> Option<i64> {
    let meta = fs::metadata(path).ok()?;
    let modified: SystemTime = meta.modified().ok()?;
    let duration = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_secs() as i64)
}

const DATA_ROOTS: &[(&str, &str)] = &[
    ("APPDATA", "AppData"),
    ("LOCALAPPDATA", "LocalAppData"),
    ("PROGRAMDATA", "ProgramData"),
];

/// Folder names we never claim as "belonging to an app" even when they happen
/// to share a token — these are shared OS/runtime locations.
const SKIP_FOLDERS: &[&str] = &[
    "microsoft", "windows", "windowsapps", "packages", "temp", "tmp",
    "comms", "d3dscache", "crashdumps", "diagnostics", "iconcache",
    "virtualstore", "publishers", "programs", "common files",
    "internet explorer",
];

/// List every data folder under the user-data roots that maps to an installed
/// app. The matching is the same token-overlap rule used by the cleanup scan,
/// inverted: a folder is *included* when it overlaps an installed app's
/// tokens, *excluded* otherwise.
#[tauri::command]
pub fn list_app_data() -> Result<Vec<AppDataEntry>, String> {
    let apps = crate::apps::list_installed_apps()?;

    // Build a token -> app-name lookup so a folder hit returns the friendly
    // name to show in the UI. First match wins, which is fine because tokens
    // are coarse (e.g. "spotify" → Spotify).
    let mut token_to_app: HashMap<String, String> = HashMap::new();
    for app in &apps {
        for tok in tokens(&app.name) {
            token_to_app.entry(tok).or_insert_with(|| app.name.clone());
        }
        if let Some(loc) = app.install_location.as_ref() {
            if let Some(leaf) = std::path::Path::new(loc)
                .file_name()
                .and_then(|s| s.to_str())
            {
                for tok in tokens(leaf) {
                    token_to_app.entry(tok).or_insert_with(|| app.name.clone());
                }
            }
        }
    }

    let mut out: Vec<AppDataEntry> = Vec::new();
    for (var, location) in DATA_ROOTS {
        let dir: PathBuf = match env_dir(var) {
            Some(d) => d,
            None => continue,
        };
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = match path.file_name().and_then(|s| s.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            let lname = name.to_lowercase();
            if SKIP_FOLDERS.iter().any(|s| lname == *s) {
                continue;
            }
            let matched = tokens(&name)
                .iter()
                .find_map(|t| token_to_app.get(t))
                .cloned();
            let Some(app_name) = matched else { continue };

            out.push(AppDataEntry {
                id: path.to_string_lossy().into_owned(),
                related_to: app_name,
                location: (*location).into(),
                path: path.to_string_lossy().into_owned(),
                size_bytes: entry_size(&path, 0),
                last_modified_unix: read_modified_unix(&path),
            });
        }
    }

    // Largest folders first so the user finds the biggest wins immediately.
    out.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(out)
}

/// Send the given app-data folders to the Recycle Bin. Reuses the cleanup
/// module's path guard so deletion stays scoped to data roots even when this
/// command is misused.
#[tauri::command]
pub fn delete_app_data(paths: Vec<String>) -> Result<AppDataDeleteReport, String> {
    let mut deleted_paths = Vec::new();
    let mut errors = Vec::new();
    for path in paths {
        match delete_path(&path) {
            Ok(()) => deleted_paths.push(path),
            Err(e) => errors.push(e),
        }
    }
    Ok(AppDataDeleteReport { deleted_paths, errors })
}

/// Reveal a folder in Explorer without touching it. Lets the user audit before
/// deciding to delete.
#[tauri::command]
pub fn open_app_data(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Could not open {path}: {e}"))
}
