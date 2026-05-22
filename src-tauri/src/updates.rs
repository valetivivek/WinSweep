//! Update detection and installation via winget (the Windows Package Manager).
//!
//! winget has no stable machine-readable output for `upgrade`, so we parse its
//! fixed-width table by deriving column offsets from the header row.

use serde::Serialize;
use std::process::Command;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdate {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub current_version: String,
    pub available_version: String,
}

/// Run winget and capture stdout as text, mapping spawn failures to a friendly
/// message (winget is absent on very old or stripped-down Windows installs).
fn winget(args: &[&str]) -> Result<String, String> {
    let output = Command::new("winget")
        .args(args)
        .output()
        .map_err(|_| "winget is not available on this system".to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Slice a fixed-width row by character offsets, trimming the result. Returns an
/// empty string when the row is shorter than the requested span.
fn column(chars: &[char], start: usize, end: Option<usize>) -> String {
    if start >= chars.len() {
        return String::new();
    }
    let end = end.unwrap_or(chars.len()).min(chars.len());
    chars[start..end.max(start)].iter().collect::<String>().trim().to_string()
}

#[tauri::command]
pub fn list_updates() -> Result<Vec<AppUpdate>, String> {
    let text = winget(&[
        "upgrade",
        "--include-unknown",
        "--accept-source-agreements",
        "--disable-interactivity",
    ])?;

    let lines: Vec<&str> = text.lines().collect();

    // Locate the header row, then read the column start offsets from it.
    let header_idx = lines.iter().position(|l| {
        l.contains("Name") && l.contains("Id") && l.contains("Version") && l.contains("Available")
    });
    let header_idx = match header_idx {
        Some(i) => i,
        None => return Ok(Vec::new()), // no header => nothing to upgrade
    };

    let header = lines[header_idx];
    let id_pos = header.find("Id").unwrap_or(0);
    let version_pos = header.find("Version").unwrap_or(id_pos);
    let available_pos = header.find("Available").unwrap_or(version_pos);
    let source_pos = header.find("Source").unwrap_or(available_pos);

    let mut updates = Vec::new();
    for line in lines.iter().skip(header_idx + 1) {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.chars().all(|c| c == '-') {
            continue;
        }
        // The data block ends at the summary line ("N upgrades available").
        if trimmed.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
            && trimmed.to_lowercase().contains("upgrade")
        {
            break;
        }

        let chars: Vec<char> = line.chars().collect();
        let name = column(&chars, 0, Some(id_pos));
        let id = column(&chars, id_pos, Some(version_pos));
        let current = column(&chars, version_pos, Some(available_pos));
        let available = column(&chars, available_pos, Some(source_pos));

        if name.is_empty() || id.is_empty() || available.is_empty() {
            continue;
        }

        updates.push(AppUpdate {
            id: id.clone(),
            name,
            publisher: id, // winget upgrade omits publisher; show the package id
            current_version: current,
            available_version: available,
        });
    }

    Ok(updates)
}

/// Upgrade a single package by its winget id, waiting for completion so the UI
/// can mark it done or failed.
#[tauri::command]
pub fn update_app(id: String) -> Result<(), String> {
    let status = Command::new("winget")
        .args([
            "upgrade",
            "--id",
            &id,
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--disable-interactivity",
        ])
        .status()
        .map_err(|_| "winget is not available on this system".to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("winget exited with code {}", status.code().unwrap_or(-1)))
    }
}
