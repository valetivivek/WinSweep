//! Installed application enumeration and per-app actions.
//!
//! Apps are read from the Windows uninstall registry keys across the 64-bit
//! and 32-bit HKLM views and the per-user HKCU view. We deliberately do not
//! distinguish Win32 from Store apps in the data we return: the UI treats
//! everything uniformly.

use base64::Engine;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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
    pub description: Option<String>,
    pub category: Option<String>,
    pub size_bytes: Option<u64>,
    pub install_date: Option<String>,
    pub last_used_at: Option<String>,
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

    // Built once: maps installed executable paths to their last-run date.
    let last_used = last_used_map();

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

            let install_location = read_string(&key, "InstallLocation");
            // Real last-run dates come from UserAssist (see `last_used_map`),
            // matched by the app's install folder. Stays None when Windows has
            // no launch record for anything under that folder.
            let last_used_at = install_location
                .as_deref()
                .and_then(|loc| match_last_used(&last_used, loc));

            apps.push(InstalledApp {
                id: format!("{}|{}", tag, subkey_name),
                name,
                publisher: read_string(&key, "Publisher").unwrap_or_default(),
                version: read_string(&key, "DisplayVersion").unwrap_or_default(),
                description: read_string(&key, "Comments"),
                category: read_string(&key, "Category"),
                size_bytes: read_size_bytes(&key),
                install_date: normalise_date(read_string(&key, "InstallDate")),
                last_used_at,
                install_location,
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

// ---------------------------------------------------------------------------
// Last-used detection via UserAssist
//
// Windows records program launches under HKCU UserAssist. Value names are the
// executable paths ROT13-encoded, and the binary payload carries the last-run
// time as a FILETIME at byte offset 60. We decode that into a map of executable
// path -> ISO date, then match each app by its install folder.
// ---------------------------------------------------------------------------

fn rot13(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'a'..='z' => (((c as u8 - b'a' + 13) % 26) + b'a') as char,
            'A'..='Z' => (((c as u8 - b'A' + 13) % 26) + b'A') as char,
            other => other,
        })
        .collect()
}

/// Resolve the common KNOWNFOLDERID GUIDs that prefix UserAssist paths to their
/// directories. Returns None for folders we do not map (those entries are
/// skipped rather than guessed).
fn known_folder_base(guid: &str) -> Option<PathBuf> {
    let var = match guid.to_uppercase().as_str() {
        "{6D809377-6AF0-444B-8957-A3773F02200E}" => "ProgramFiles",     // 64-bit
        "{905E63B6-C1BF-494E-B29C-65B732D3D21A}" => "ProgramFiles",     // 64-bit (alt)
        "{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}" => "ProgramFiles(x86)",
        "{F38BF404-1D43-42F2-9305-67DE0B28FC23}" => "WINDIR",
        "{F1B32785-6FBA-4FCF-9D55-7B8E7F157091}" => "LOCALAPPDATA",
        "{3EB685DB-65F9-4CF6-A03A-E3EF65729F3D}" => "APPDATA",
        _ => return None,
    };
    std::env::var_os(var).map(PathBuf::from)
}

/// Turn a decoded UserAssist name into an absolute executable path, or None if
/// it is not a resolvable .exe entry.
fn resolve_ua_path(decoded: &str) -> Option<PathBuf> {
    let d = decoded.trim();
    if !d.to_lowercase().ends_with(".exe") {
        return None;
    }
    if let Some(rest) = d.strip_prefix('{') {
        let (body, tail) = rest.split_once('}')?;
        let base = known_folder_base(&format!("{{{body}}}"))?;
        Some(base.join(tail.trim_start_matches('\\')))
    } else if d.len() > 2 && d.as_bytes()[1] == b':' {
        Some(PathBuf::from(d))
    } else {
        None
    }
}

/// Convert a Windows FILETIME (100ns ticks since 1601) to an ISO "YYYY-MM-DD"
/// date using a calendar conversion, avoiding any date dependency.
fn iso_date_from_filetime(ft: u64) -> Option<String> {
    if ft == 0 {
        return None;
    }
    let unix = (ft / 10_000_000) as i64 - 11_644_473_600;
    if unix <= 0 {
        return None;
    }
    let days = unix.div_euclid(86_400);
    // days_to_civil (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { year + 1 } else { year };
    Some(format!("{year:04}-{month:02}-{day:02}"))
}

/// Decode every UserAssist entry into (executable path, last-run ISO date).
fn last_used_map() -> Vec<(PathBuf, String)> {
    let mut out = Vec::new();
    let ua = match RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist",
        KEY_READ,
    ) {
        Ok(k) => k,
        Err(_) => return out,
    };

    for guid_name in ua.enum_keys().flatten() {
        let count = match ua.open_subkey_with_flags(format!(r"{guid_name}\Count"), KEY_READ) {
            Ok(k) => k,
            Err(_) => continue,
        };
        for (name, value) in count.enum_values().flatten() {
            let bytes = &value.bytes;
            if bytes.len() < 68 {
                continue;
            }
            let path = match resolve_ua_path(&rot13(&name)) {
                Some(p) => p,
                None => continue,
            };
            let ft = u64::from_le_bytes(bytes[60..68].try_into().unwrap());
            if let Some(date) = iso_date_from_filetime(ft) {
                out.push((path, date));
            }
        }
    }
    out
}

/// Most recent last-run date among executables inside `install_location`.
fn match_last_used(map: &[(PathBuf, String)], install_location: &str) -> Option<String> {
    let loc = install_location.trim().to_lowercase();
    if loc.is_empty() {
        return None;
    }
    map.iter()
        .filter(|(p, _)| p.to_string_lossy().to_lowercase().starts_with(&loc))
        .map(|(_, d)| d.clone())
        .max() // ISO dates compare correctly as strings
}

// ---------------------------------------------------------------------------
// App icons
//
// Icons are extracted from the `DisplayIcon` registry value (an .exe or .ico,
// optionally suffixed with an index) and returned as base64 PNG data URLs. The
// frontend requests them in a batch after the list renders, and falls back to a
// monogram for apps with no usable icon.
// ---------------------------------------------------------------------------

/// Resolve the `DisplayIcon` value to an existing file path, dropping any
/// trailing ",index" and surrounding quotes.
fn parse_icon_source(raw: &str) -> Option<String> {
    let raw = raw.trim().trim_matches('"');
    let path = match raw.rsplit_once(',') {
        Some((p, idx)) if idx.trim().parse::<i64>().is_ok() => p,
        _ => raw,
    };
    let path = path.trim().trim_matches('"');
    if !path.is_empty() && Path::new(path).exists() {
        Some(path.to_string())
    } else {
        None
    }
}

/// Extract a file's associated icon and encode it as PNG bytes.
fn extract_icon_png(path: &str) -> Option<Vec<u8>> {
    use windows::core::PCWSTR;
    use windows::Win32::Graphics::Gdi::{
        DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, CreateCompatibleDC, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
    };
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();

    unsafe {
        let mut info = SHFILEINFOW::default();
        let res = SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            Default::default(),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        if res == 0 || info.hIcon.is_invalid() {
            return None;
        }
        let hicon = info.hIcon;

        let mut icon_info = ICONINFO::default();
        if GetIconInfo(hicon, &mut icon_info).is_err() {
            let _ = DestroyIcon(hicon);
            return None;
        }

        let mut bmp = BITMAP::default();
        let got = GetObjectW(
            HGDIOBJ(icon_info.hbmColor.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut _ as *mut _),
        );
        let width = bmp.bmWidth;
        let height = bmp.bmHeight;
        if got == 0 || width <= 0 || height <= 0 {
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
            let _ = DestroyIcon(hicon);
            return None;
        }

        let mut header = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height, // negative => top-down rows
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        };
        let mut bmi = BITMAPINFO {
            bmiHeader: header,
            ..Default::default()
        };

        let pixel_count = (width * height) as usize;
        let mut buffer = vec![0u8; pixel_count * 4];
        let hdc = CreateCompatibleDC(None);
        let scanned = GetDIBits(
            hdc,
            HBITMAP(icon_info.hbmColor.0),
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );
        header = bmi.bmiHeader; // keep clippy quiet about the unused write-back
        let _ = header;

        let _ = DeleteDC(hdc);
        let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
        let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
        let _ = DestroyIcon(hicon);

        if scanned == 0 {
            return None;
        }

        // GetDIBits gives BGRA; convert to RGBA and recover a flat alpha for the
        // rare icons that report all-zero alpha.
        let mut any_alpha = false;
        for px in buffer.chunks_exact_mut(4) {
            px.swap(0, 2);
            if px[3] != 0 {
                any_alpha = true;
            }
        }
        if !any_alpha {
            for px in buffer.chunks_exact_mut(4) {
                px[3] = 255;
            }
        }

        let mut png = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut png, width as u32, height as u32);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().ok()?;
            writer.write_image_data(&buffer).ok()?;
        }
        Some(png)
    }
}

/// Return base64 PNG data URLs for the given app ids, omitting any without a
/// usable icon. Called once per list load, after rows are on screen.
#[tauri::command]
pub fn app_icons(ids: Vec<String>) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for id in ids {
        let icon = open_entry(&id)
            .ok()
            .and_then(|key| read_string(&key, "DisplayIcon"))
            .and_then(|raw| parse_icon_source(&raw))
            .and_then(|path| extract_icon_png(&path));
        if let Some(bytes) = icon {
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            out.insert(id, format!("data:image/png;base64,{encoded}"));
        }
    }
    out
}
