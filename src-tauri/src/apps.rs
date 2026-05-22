//! Installed application enumeration and per-app actions.
//!
//! Apps are read from the Windows uninstall registry keys across the 64-bit
//! and 32-bit HKLM views and the per-user HKCU view. We deliberately do not
//! distinguish Win32 from Store apps in the data we return: the UI treats
//! everything uniformly.

use serde::Serialize;
use std::process::Command;
use winreg::enums::*;
use winreg::RegKey;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    /// Encodes the registry origin so actions can re-locate the entry.
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub version: String,
    pub size_bytes: Option<u64>,
    pub install_date: Option<String>,
    pub install_location: Option<String>,
}

/// The three uninstall locations we read, each tagged so an id round-trips back
/// to the exact hive and view it came from. The hive is resolved from the tag
/// (see `predef_for`) to avoid depending on winreg's HKEY representation.
const SOURCES: &[(&str, &str)] = &[
    ("HKLM", r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ("HKLM32", r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
    ("HKCU", r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
];

fn predef_for(tag: &str) -> RegKey {
    match tag {
        "HKCU" => RegKey::predef(HKEY_CURRENT_USER),
        _ => RegKey::predef(HKEY_LOCAL_MACHINE),
    }
}

fn read_string(key: &RegKey, name: &str) -> Option<String> {
    key.get_value::<String, _>(name).ok().filter(|s| !s.trim().is_empty())
}

/// EstimatedSize is a DWORD in kilobytes; widen to bytes.
fn read_size_bytes(key: &RegKey) -> Option<u64> {
    key.get_value::<u32, _>("EstimatedSize").ok().map(|kb| kb as u64 * 1024)
}

/// Registry install dates are "YYYYMMDD"; normalise to ISO "YYYY-MM-DD".
fn normalise_date(raw: Option<String>) -> Option<String> {
    let raw = raw?;
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 8 {
        return None;
    }
    Some(format!("{}-{}-{}", &digits[0..4], &digits[4..6], &digits[6..8]))
}

/// True for entries that are updates, OS components, or otherwise not things a
/// user thinks of as an installed app.
fn is_noise(key: &RegKey, name: &str) -> bool {
    if key.get_value::<u32, _>("SystemComponent").unwrap_or(0) == 1 {
        return true;
    }
    // Sub-entries that belong to a parent product (e.g. bundled updates).
    if read_string(key, "ParentKeyName").is_some() || read_string(key, "ParentDisplayName").is_some() {
        return true;
    }
    let release = read_string(key, "ReleaseType").unwrap_or_default().to_lowercase();
    if release.contains("update") || release.contains("hotfix") || release.contains("security") {
        return true;
    }
    // Windows servicing entries.
    name.starts_with("KB") && name[2..].chars().all(|c| c.is_ascii_digit()) && name.len() > 5
}

#[tauri::command]
pub fn list_installed_apps() -> Result<Vec<InstalledApp>, String> {
    let mut apps: Vec<InstalledApp> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (tag, path) in SOURCES {
        let root = predef_for(tag);
        let uninstall = match root.open_subkey_with_flags(path, KEY_READ) {
            Ok(k) => k,
            Err(_) => continue,
        };

        for subkey_name in uninstall.enum_keys().flatten() {
            let key = match uninstall.open_subkey_with_flags(&subkey_name, KEY_READ) {
                Ok(k) => k,
                Err(_) => continue,
            };

            let name = match read_string(&key, "DisplayName") {
                Some(n) => n,
                None => continue,
            };
            if is_noise(&key, &subkey_name) {
                continue;
            }

            // Collapse duplicates that appear in multiple hives/views.
            let dedup_key = format!("{}::{}", name.to_lowercase(), read_string(&key, "DisplayVersion").unwrap_or_default());
            if !seen.insert(dedup_key) {
                continue;
            }

            apps.push(InstalledApp {
                id: format!("{}|{}", tag, subkey_name),
                name,
                publisher: read_string(&key, "Publisher").unwrap_or_default(),
                version: read_string(&key, "DisplayVersion").unwrap_or_default(),
                size_bytes: read_size_bytes(&key),
                install_date: normalise_date(read_string(&key, "InstallDate")),
                install_location: read_string(&key, "InstallLocation"),
            });
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

/// Re-open the registry entry an id points at, returning its open key.
fn open_entry(id: &str) -> Result<RegKey, String> {
    let (tag, subkey) = id.split_once('|').ok_or("Malformed app id")?;
    let path = SOURCES
        .iter()
        .find(|(t, _)| *t == tag)
        .map(|(_, p)| *p)
        .ok_or("Unknown app source")?;
    predef_for(tag)
        .open_subkey_with_flags(path, KEY_READ)
        .and_then(|k| k.open_subkey_with_flags(subkey, KEY_READ))
        .map_err(|e| format!("Could not read registry entry: {e}"))
}

/// Launch the app's registered uninstaller. Uninstallers are interactive, so we
/// spawn and return immediately rather than waiting for completion.
#[tauri::command]
pub fn uninstall_app(id: String) -> Result<(), String> {
    let key = open_entry(&id)?;
    let command = read_string(&key, "QuietUninstallString")
        .or_else(|| read_string(&key, "UninstallString"))
        .ok_or("No uninstall command is registered for this app")?;

    Command::new("cmd")
        .args(["/C", &command])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to start uninstaller: {e}"))
}

/// Reveal the app's install folder in File Explorer.
#[tauri::command]
pub fn open_install_location(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("This app does not report an install location".into());
    }
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to open location: {e}"))
}
