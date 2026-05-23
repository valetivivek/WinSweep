//! Residual file and registry scanning, plus guarded deletion.
//!
//! "Residual" detection is necessarily heuristic: a folder under %AppData% is
//! flagged only when it matches no currently installed app and is not a known
//! system folder. Nothing is ever deleted without the user selecting it and
//! confirming; deletion additionally re-validates that every target sits inside
//! an allowed root before touching the disk or registry.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use winreg::enums::*;
use winreg::RegKey;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResidualItem {
    pub id: String,
    pub related_to: String,
    pub kind: String,     // "folder" | "file" | "registry"
    pub location: String, // "AppData" | "LocalAppData" | "ProgramData" | "Temp" | "Registry"
    /// Heuristic classification so the UI can group by what the leftover is,
    /// not just where it lives: "Logs" | "Cache" | "Config" | "Data" |
    /// "Crashes" | "Installer" | "Other".
    pub category: String,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteReport {
    pub deleted_ids: Vec<String>,
    pub errors: Vec<String>,
}

/// Folder and key names that are part of Windows or shared infrastructure and
/// must never be offered for deletion, even if no app claims them.
const DENYLIST: &[&str] = &[
    "microsoft", "windows", "windowsapps", "packages", "temp", "tmp", "google",
    "mozilla", "nvidia", "intel", "amd", "apple computer", "comms", "d3dscache",
    "crashdumps", "diagnostics", "elevateddiagnostics", "iconcache", "virtualstore",
    "isolatedstorage", "connecteddevicesplatform", "publishers", "microsoftedge",
    "microsoft corporation", "programs", "common files", "internet explorer",
];

/// Lowercased alphanumeric tokens of length >= 3, used to match folder names
/// against installed apps and to filter the denylist.
pub(crate) fn tokens(s: &str) -> HashSet<String> {
    s.to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|t| t.len() >= 3)
        .map(|t| t.to_string())
        .collect()
}

/// Sum the size of a file, or recursively of a directory. Bounded by depth to
/// avoid pathological traversals; symlinks are not followed.
pub(crate) fn entry_size(path: &Path, depth: u32) -> u64 {
    let meta = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return 0,
    };
    if meta.file_type().is_symlink() {
        return 0;
    }
    if meta.is_file() {
        return meta.len();
    }
    if meta.is_dir() && depth < 24 {
        let mut total = 0;
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                total += entry_size(&entry.path(), depth + 1);
            }
        }
        return total;
    }
    0
}

pub(crate) fn env_dir(var: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(PathBuf::from).filter(|p| p.exists())
}

/// Look at up to 20 entries inside a folder and return the dominant category
/// hint if more than half of them point the same way. Used to classify orphan
/// folders whose name itself reveals nothing (e.g. an app's data root).
fn sample_folder_category(path: &Path) -> Option<&'static str> {
    let entries: Vec<_> = fs::read_dir(path).ok()?.flatten().take(20).collect();
    if entries.is_empty() {
        return None;
    }
    let mut log = 0;
    let mut cache = 0;
    let mut crash = 0;
    for entry in &entries {
        let n = entry.file_name().to_string_lossy().to_lowercase();
        if n.ends_with(".log") || n == "logs" || n == "log" {
            log += 1;
        }
        if n.contains("cache") {
            cache += 1;
        }
        if n.contains("crash") || n.ends_with(".dmp") || n.ends_with(".mdmp") {
            crash += 1;
        }
    }
    let total = entries.len();
    if log * 2 > total {
        return Some("Logs");
    }
    if cache * 2 > total {
        return Some("Cache");
    }
    if crash * 2 > total {
        return Some("Crashes");
    }
    None
}

/// Classify a residual so the UI can group "Logs across every app" or "all
/// the caches" without the user having to read paths. Inference order:
/// registry → keyword in path/name → file extension → folder content sample
/// → default "Data".
fn categorize(path: &Path, kind: &str) -> String {
    if kind == "registry" {
        return "Config".into();
    }

    let full = path.to_string_lossy().to_lowercase();
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    if name.contains("cache")
        || full.contains("\\cache\\")
        || full.contains("\\caches\\")
        || full.contains("\\code cache\\")
        || full.contains("\\gpucache\\")
    {
        return "Cache".into();
    }
    if name.contains("crash")
        || name.contains("dump")
        || full.contains("\\crashpad\\")
        || full.contains("\\crashreports\\")
        || full.contains("\\crashdumps\\")
    {
        return "Crashes".into();
    }
    if name == "logs" || name == "log" || full.contains("\\logs\\") || full.contains("\\log\\") {
        return "Logs".into();
    }

    if kind == "file" {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();
        match ext.as_str() {
            "log" => return "Logs".into(),
            "dmp" | "mdmp" => return "Crashes".into(),
            "tmp" | "thumbcache" => return "Cache".into(),
            "cache" => return "Cache".into(),
            "msi" | "msu" => return "Installer".into(),
            "exe" if name.contains("install") || name.contains("setup") => {
                return "Installer".into();
            }
            "ini" | "cfg" | "conf" | "yaml" | "yml" | "toml" => return "Config".into(),
            _ => {}
        }
    }

    if kind == "folder" {
        if let Some(c) = sample_folder_category(path) {
            return c.into();
        }
    }

    "Data".into()
}

/// Collect tokens from every installed app (names, publishers, install folder
/// leaf) so we can recognise folders that belong to live software.
fn installed_tokens() -> HashSet<String> {
    let mut set = HashSet::new();
    for app in crate::apps::list_installed_apps().unwrap_or_default() {
        set.extend(tokens(&app.name));
        set.extend(tokens(&app.publisher));
        if let Some(loc) = app.install_location {
            if let Some(leaf) = Path::new(&loc).file_name().and_then(|s| s.to_str()) {
                set.extend(tokens(leaf));
            }
        }
    }
    set
}

fn is_known_or_system(name: &str, installed: &HashSet<String>) -> bool {
    let lname = name.to_lowercase();
    if DENYLIST.iter().any(|d| lname == *d || lname.contains(d)) {
        return true;
    }
    !tokens(name).is_disjoint(installed)
}

/// Scan the user-data roots for top-level folders that no installed app claims.
fn scan_data_root(
    var: &str,
    location: &str,
    installed: &HashSet<String>,
    out: &mut Vec<ResidualItem>,
) {
    let dir = match env_dir(var) {
        Some(d) => d,
        None => return,
    };
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return,
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
        if is_known_or_system(&name, installed) {
            continue;
        }
        let category = categorize(&path, "folder");
        out.push(ResidualItem {
            id: path.to_string_lossy().into_owned(),
            related_to: name,
            kind: "folder".into(),
            location: location.into(),
            category,
            path: path.to_string_lossy().into_owned(),
            size_bytes: entry_size(&path, 0),
        });
    }
}

/// Everything directly under %TEMP% is fair game: temporary by definition.
fn scan_temp(out: &mut Vec<ResidualItem>) {
    let dir = match env_dir("TEMP") {
        Some(d) => d,
        None => return,
    };
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let kind = if path.is_dir() { "folder" } else { "file" };
        let category = categorize(&path, kind);
        out.push(ResidualItem {
            id: path.to_string_lossy().into_owned(),
            related_to: name,
            kind: kind.into(),
            location: "Temp".into(),
            category,
            path: path.to_string_lossy().into_owned(),
            size_bytes: entry_size(&path, 0),
        });
    }
}

/// Scan HKCU\Software for top-level vendor keys with no matching installed app.
/// Capped to keep the review list manageable.
fn scan_registry(installed: &HashSet<String>, out: &mut Vec<ResidualItem>) {
    let software = match RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags("Software", KEY_READ) {
        Ok(k) => k,
        Err(_) => return,
    };
    let mut count = 0;
    for name in software.enum_keys().flatten() {
        if count >= 40 {
            break;
        }
        if is_known_or_system(&name, installed) {
            continue;
        }
        let full = format!(r"HKCU\Software\{name}");
        out.push(ResidualItem {
            id: full.clone(),
            related_to: name,
            kind: "registry".into(),
            location: "Registry".into(),
            category: "Config".into(),
            path: full,
            size_bytes: 0,
        });
        count += 1;
    }
}

/// Path to the JSON file that persists user-ignored residual paths.
fn ignore_store_path() -> Option<PathBuf> {
    let base = std::env::var_os("APPDATA").map(PathBuf::from)?;
    Some(base.join("WinSweep").join("ignored.json"))
}

/// Load the set of paths the user has chosen to never flag again.
fn load_ignored() -> HashSet<String> {
    match ignore_store_path() {
        Some(path) => fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str::<Vec<String>>(&t).ok())
            .map(|v| v.into_iter().collect())
            .unwrap_or_default(),
        None => HashSet::new(),
    }
}

fn save_ignored(set: &HashSet<String>) -> Result<(), String> {
    let path = ignore_store_path().ok_or("Could not resolve the WinSweep config directory")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let list: Vec<&String> = set.iter().collect();
    fs::write(&path, serde_json::to_string(&list).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

/// The paths the user has permanently excluded from cleanup scans.
#[tauri::command]
pub fn list_ignored() -> Vec<String> {
    let mut v: Vec<String> = load_ignored().into_iter().collect();
    v.sort();
    v
}

/// Add paths to the ignore list so future scans skip them.
#[tauri::command]
pub fn add_ignored(paths: Vec<String>) -> Result<(), String> {
    let mut set = load_ignored();
    set.extend(paths);
    save_ignored(&set)
}

/// Forget every ignored path, so the next scan surfaces them again.
#[tauri::command]
pub fn clear_ignored() -> Result<(), String> {
    save_ignored(&HashSet::new())
}

#[tauri::command]
pub fn scan_residuals() -> Result<Vec<ResidualItem>, String> {
    let installed = installed_tokens();
    let mut items = Vec::new();

    scan_data_root("APPDATA", "AppData", &installed, &mut items);
    scan_data_root("LOCALAPPDATA", "LocalAppData", &installed, &mut items);
    scan_data_root("PROGRAMDATA", "ProgramData", &installed, &mut items);
    scan_temp(&mut items);
    scan_registry(&installed, &mut items);

    // Drop anything the user has explicitly chosen to ignore.
    let ignored = load_ignored();
    items.retain(|i| !ignored.contains(&i.path));

    // Largest reclaimable first; registry keys (size 0) settle at the end.
    items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(items)
}

/// True when `path` resolves to a location inside one of the cleanup roots. This
/// is the guard that prevents deletion of anything outside the scanned areas.
pub(crate) fn within_allowed_root(path: &Path) -> bool {
    let roots = ["APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "TEMP"];
    let canonical = match fs::canonicalize(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    roots.iter().filter_map(|v| env_dir(v)).any(|root| {
        fs::canonicalize(&root)
            .map(|r| canonical.starts_with(&r))
            .unwrap_or(false)
    })
}

pub(crate) fn delete_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !within_allowed_root(p) {
        return Err(format!("Refused: {path} is outside the cleanup roots"));
    }
    // Confirm it still exists before touching it (the scan list can go stale).
    fs::symlink_metadata(p).map_err(|e| format!("{path}: {e}"))?;
    // Send to the Recycle Bin rather than deleting permanently, so a mistaken
    // cleanup is always recoverable. Registry keys cannot be recycled and are
    // handled separately in `delete_registry`.
    trash::delete(p).map_err(|e| format!("{path}: {e}"))
}

fn delete_registry(key_path: &str) -> Result<(), String> {
    // Only HKCU\Software keys are ever eligible.
    let suffix = key_path
        .strip_prefix(r"HKCU\Software\")
        .ok_or_else(|| format!("Refused: {key_path} is not under HKCU\\Software"))?;
    if suffix.is_empty() || suffix.contains("..") {
        return Err(format!("Refused: invalid key {key_path}"));
    }
    let software = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags("Software", KEY_ALL_ACCESS)
        .map_err(|e| format!("{key_path}: {e}"))?;
    software
        .delete_subkey_all(suffix)
        .map_err(|e| format!("{key_path}: {e}"))
}

/// Delete each item, partitioning the outcome into: succeeded ids, items that
/// failed specifically because of access/permission denial (candidates for
/// elevation), and other error messages.
fn perform_deletions(items: &[ResidualItem]) -> (Vec<String>, Vec<ResidualItem>, Vec<String>) {
    let mut deleted = Vec::new();
    let mut denied = Vec::new();
    let mut other = Vec::new();

    for item in items {
        let result = if item.kind == "registry" {
            delete_registry(&item.path)
        } else {
            delete_path(&item.path)
        };
        match result {
            Ok(()) => deleted.push(item.id.clone()),
            Err(e) => {
                let low = e.to_lowercase();
                if low.contains("denied") || low.contains("os error 5") {
                    denied.push(item.clone());
                } else {
                    other.push(e);
                }
            }
        }
    }

    (deleted, denied, other)
}

/// Relaunch WinSweep itself elevated to delete the given items, triggering a
/// single UAC prompt. The elevated child reuses the exact same validated delete
/// logic (see `run_elevated_delete`), so nothing outside the cleanup roots can
/// be removed even with admin rights.
fn elevate_and_delete(items: &[ResidualItem]) -> Result<DeleteReport, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = std::env::temp_dir();
    let stamp = std::process::id();
    let targets_path = dir.join(format!("winsweep-del-{stamp}.json"));
    let report_path = dir.join(format!("winsweep-rep-{stamp}.json"));

    fs::write(
        &targets_path,
        serde_json::to_string(items).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    // Single-quote each PowerShell argument, escaping embedded quotes.
    let q = |p: &Path| format!("'{}'", p.to_string_lossy().replace('\'', "''"));
    let command = format!(
        "Start-Process -FilePath {} -ArgumentList @('--elevated-delete',{},{}) -Verb RunAs -Wait",
        q(&exe),
        q(&targets_path),
        q(&report_path),
    );

    let status = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &command])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        let _ = fs::remove_file(&targets_path);
        return Err("administrator approval was declined".into());
    }

    let report = fs::read_to_string(&report_path)
        .map_err(|e| e.to_string())
        .and_then(|t| serde_json::from_str::<DeleteReport>(&t).map_err(|e| e.to_string()));
    let _ = fs::remove_file(&targets_path);
    let _ = fs::remove_file(&report_path);
    report
}

#[tauri::command]
pub fn delete_residuals(items: Vec<ResidualItem>) -> Result<DeleteReport, String> {
    let (mut deleted_ids, denied, mut errors) = perform_deletions(&items);

    // Anything blocked by permissions gets one elevated retry via UAC.
    if !denied.is_empty() {
        match elevate_and_delete(&denied) {
            Ok(report) => {
                deleted_ids.extend(report.deleted_ids);
                errors.extend(report.errors);
            }
            Err(e) => {
                errors.push(format!(
                    "{} protected item(s) need administrator rights: {}",
                    denied.len(),
                    e
                ));
            }
        }
    }

    Ok(DeleteReport { deleted_ids, errors })
}

/// Entry point for the elevated child process. Reads a targets file written by
/// `elevate_and_delete`, deletes them with the same guards, and writes a report
/// the parent reads back. Never re-elevates, so there is no prompt loop.
pub fn run_elevated_delete(targets_path: &str, report_path: &str) {
    let report = match fs::read_to_string(targets_path)
        .ok()
        .and_then(|t| serde_json::from_str::<Vec<ResidualItem>>(&t).ok())
    {
        Some(items) => {
            let (deleted_ids, denied, mut errors) = perform_deletions(&items);
            for item in denied {
                errors.push(format!("{}: access denied", item.path));
            }
            DeleteReport { deleted_ids, errors }
        }
        None => DeleteReport {
            deleted_ids: Vec::new(),
            errors: vec!["Could not read deletion targets".into()],
        },
    };
    let _ = fs::write(report_path, serde_json::to_string(&report).unwrap_or_default());
}
