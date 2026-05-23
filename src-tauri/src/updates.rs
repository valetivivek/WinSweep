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
    /// Where the upgrade comes from: "winget", "msstore", or another registered
    /// source. Lets the UI badge Store apps without distinguishing them in the
    /// installed-apps list.
    pub source: String,
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

/// Parse winget's `upgrade` table into structured updates, tagging each row
/// with the registered source it came from (winget / msstore / …) so the UI
/// can flag Store apps without a second query.
fn parse_upgrade_table(text: &str, default_source: &str) -> Vec<AppUpdate> {
    let lines: Vec<&str> = text.lines().collect();

    let header_idx = lines.iter().position(|l| {
        l.contains("Name") && l.contains("Id") && l.contains("Version") && l.contains("Available")
    });
    let header_idx = match header_idx {
        Some(i) => i,
        None => return Vec::new(),
    };

    let header = lines[header_idx];
    let id_pos = header.find("Id").unwrap_or(0);
    let version_pos = header.find("Version").unwrap_or(id_pos);
    let available_pos = header.find("Available").unwrap_or(version_pos);
    let source_pos = header.find("Source");

    let mut updates = Vec::new();
    for line in lines.iter().skip(header_idx + 1) {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.chars().all(|c| c == '-') {
            continue;
        }
        if trimmed.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
            && trimmed.to_lowercase().contains("upgrade")
        {
            break;
        }

        let chars: Vec<char> = line.chars().collect();
        let name = column(&chars, 0, Some(id_pos));
        let id = column(&chars, id_pos, Some(version_pos));
        let available_end = source_pos.unwrap_or(chars.len());
        let current = column(&chars, version_pos, Some(available_pos));
        let available = column(&chars, available_pos, Some(available_end));
        let source = source_pos
            .map(|p| column(&chars, p, None))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| default_source.to_string());

        if name.is_empty() || id.is_empty() || available.is_empty() {
            continue;
        }

        updates.push(AppUpdate {
            id: id.clone(),
            name,
            publisher: id,
            current_version: current,
            available_version: available,
            source,
        });
    }
    updates
}

#[tauri::command]
pub fn list_updates() -> Result<Vec<AppUpdate>, String> {
    // Default pass covers every registered source (winget + msstore). Most
    // Store apps with a winget mapping surface here without a second query.
    let text = winget(&[
        "upgrade",
        "--include-unknown",
        "--accept-source-agreements",
        "--disable-interactivity",
    ])?;
    let mut updates = parse_upgrade_table(&text, "winget");

    // Second pass scoped to msstore. Some Store apps only appear when we ask
    // that source explicitly (and accept its agreement). Failures here are
    // non-fatal: winget may not have the msstore source on stripped installs.
    if let Ok(store_text) = winget(&[
        "upgrade",
        "--source",
        "msstore",
        "--include-unknown",
        "--accept-source-agreements",
        "--disable-interactivity",
    ]) {
        let store_updates = parse_upgrade_table(&store_text, "msstore");
        let existing: std::collections::HashSet<String> =
            updates.iter().map(|u| u.id.clone()).collect();
        for u in store_updates {
            if !existing.contains(&u.id) {
                updates.push(u);
            }
        }
    }

    Ok(updates)
}

/// Upgrade a single package by id. When `source` is provided (e.g. "msstore"),
/// we pin winget to that source so Store apps install via the correct
/// pipeline. Empty source defaults to winget's automatic resolution.
#[tauri::command]
pub fn update_app(id: String, source: Option<String>) -> Result<(), String> {
    let mut args: Vec<String> = vec![
        "upgrade".into(),
        "--id".into(),
        id.clone(),
        "--exact".into(),
        "--silent".into(),
        "--accept-package-agreements".into(),
        "--accept-source-agreements".into(),
        "--disable-interactivity".into(),
    ];
    if let Some(src) = source.filter(|s| !s.trim().is_empty()) {
        args.push("--source".into());
        args.push(src);
    }

    let status = Command::new("winget")
        .args(&args)
        .status()
        .map_err(|_| "winget is not available on this system".to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("winget exited with code {}", status.code().unwrap_or(-1)))
    }
}
