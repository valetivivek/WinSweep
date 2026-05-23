//! Weekly scheduled cleanup via Windows Task Scheduler.
//!
//! The user picks a day + time + which categories to sweep. We persist that to
//! %APPDATA%\WinSweep\schedule.json and register a single `WinSweep Cleanup`
//! scheduled task via schtasks.exe that re-launches this same binary with the
//! `--scheduled-clean` flag. The headless entry point reads the same config
//! file and runs the deletions with no UI.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

const TASK_NAME: &str = "WinSweep Cleanup";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleConfig {
    pub enabled: bool,
    /// "MON".."SUN" — matches schtasks /D values exactly.
    pub day_of_week: String,
    /// 0..23
    pub hour: u32,
    /// 0..59
    pub minute: u32,
    pub clean_temp: bool,
    pub clean_recycle_bin: bool,
    pub clean_caches: bool,
}

impl Default for ScheduleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            day_of_week: "SUN".into(),
            hour: 3,
            minute: 0,
            clean_temp: true,
            clean_recycle_bin: true,
            clean_caches: false,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleResult {
    pub success: bool,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickSweepReport {
    pub temp_items: usize,
    pub recycle_bin_emptied: bool,
    pub cache_items: usize,
    /// Human-readable summary suitable for a sidebar inline note.
    pub message: String,
}

fn config_path() -> Option<PathBuf> {
    let base = std::env::var_os("APPDATA").map(PathBuf::from)?;
    Some(base.join("WinSweep").join("schedule.json"))
}

fn last_run_path() -> Option<PathBuf> {
    let base = std::env::var_os("APPDATA").map(PathBuf::from)?;
    Some(base.join("WinSweep").join("last_scheduled_run.txt"))
}

/// Read the saved schedule, falling back to defaults when the file is missing
/// or unparseable. Never returns an error — a corrupt file shouldn't prevent
/// the Settings page from rendering.
#[tauri::command]
pub fn get_schedule() -> ScheduleConfig {
    let Some(path) = config_path() else {
        return ScheduleConfig::default();
    };
    fs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str::<ScheduleConfig>(&t).ok())
        .unwrap_or_default()
}

fn write_config(cfg: &ScheduleConfig) -> Result<(), String> {
    let path = config_path().ok_or("Could not resolve the WinSweep config directory")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

/// Persist the schedule and, depending on `cfg.enabled`, register or remove
/// the Windows scheduled task. Returns a human-readable status message.
#[tauri::command]
pub fn set_schedule(cfg: ScheduleConfig) -> Result<ScheduleResult, String> {
    write_config(&cfg)?;

    if cfg.enabled {
        register_task(&cfg)
    } else {
        let _ = remove_task();
        Ok(ScheduleResult {
            success: true,
            message: "Scheduled cleanup disabled.".into(),
        })
    }
}

fn register_task(cfg: &ScheduleConfig) -> Result<ScheduleResult, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe.to_string_lossy().to_string();
    let time = format!("{:02}:{:02}", cfg.hour, cfg.minute);

    // Always /F (force overwrite) so updates from the UI just replace the
    // existing definition without an orphaned task piling up.
    let status = Command::new("schtasks")
        .args([
            "/Create",
            "/F",
            "/SC", "WEEKLY",
            "/D", &cfg.day_of_week,
            "/ST", &time,
            "/TN", TASK_NAME,
            "/TR", &format!("\"{}\" --scheduled-clean", exe_str),
        ])
        .status()
        .map_err(|e| format!("Could not run schtasks: {e}"))?;

    if status.success() {
        Ok(ScheduleResult {
            success: true,
            message: format!("Scheduled for {} at {}", cfg.day_of_week, time),
        })
    } else {
        Err(format!(
            "schtasks exited with code {}. You may need to run WinSweep as Administrator to register a scheduled task.",
            status.code().unwrap_or(-1)
        ))
    }
}

fn remove_task() -> Result<(), String> {
    Command::new("schtasks")
        .args(["/Delete", "/F", "/TN", TASK_NAME])
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the ISO timestamp of the last scheduled run, if any. Null when the
/// task has never fired (or the file is missing).
#[tauri::command]
pub fn get_last_scheduled_run() -> Option<String> {
    let path = last_run_path()?;
    fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
}

/// Run each enabled category and return a structured report. Honors the
/// per-category booleans but ignores `cfg.enabled`, so both the scheduled
/// task (which gates on `enabled` itself) and the on-demand Quick Sweep
/// button (which does not) can share this logic.
fn perform_sweep(cfg: &ScheduleConfig) -> QuickSweepReport {
    let mut parts: Vec<String> = Vec::new();

    let temp_items = if cfg.clean_temp {
        let n = sweep_temp();
        parts.push(format!("Temp: {n} items"));
        n
    } else {
        0
    };

    let recycle_bin_emptied = if cfg.clean_recycle_bin {
        match empty_recycle_bin() {
            Ok(()) => {
                parts.push("Recycle Bin emptied".into());
                true
            }
            Err(e) => {
                parts.push(format!("Recycle Bin: {e}"));
                false
            }
        }
    } else {
        false
    };

    let cache_items = if cfg.clean_caches {
        let n = sweep_caches();
        parts.push(format!("Caches: {n} items"));
        n
    } else {
        0
    };

    let message = if parts.is_empty() {
        "Nothing was cleaned. Open Settings to choose categories.".into()
    } else {
        parts.join("; ")
    };

    QuickSweepReport {
        temp_items,
        recycle_bin_emptied,
        cache_items,
        message,
    }
}

/// The entry point invoked when the binary is relaunched with
/// `--scheduled-clean`. Reads the saved config and performs each enabled
/// sweep, with no UI. Touches only paths inside the cleanup-allowed roots.
pub fn run_scheduled_clean() {
    let cfg = get_schedule();
    if !cfg.enabled {
        return;
    }

    let report = perform_sweep(&cfg);

    // Stamp the run so the UI can show "last ran on …".
    if let Some(path) = last_run_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let now = chrono_like_now();
        let _ = fs::write(&path, format!("{now}\n{}", report.message));
    }
}

/// On-demand sweep fired from the sidebar Quick Sweep button. Uses the saved
/// Settings config to decide what to clean (Temp / Recycle Bin / caches),
/// bypassing the `enabled` flag, and returns the report so the UI can show
/// a summary inline.
#[tauri::command]
pub fn quick_sweep() -> Result<QuickSweepReport, String> {
    let cfg = get_schedule();
    Ok(perform_sweep(&cfg))
}

/// Emit an ISO-ish timestamp without pulling in a date crate. Format:
/// "YYYY-MM-DDTHH:MM:SSZ" derived from SystemTime since UNIX_EPOCH.
fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    // Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
    let days = secs.div_euclid(86_400);
    let time = secs.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    let hour = time / 3600;
    let min = (time % 3600) / 60;
    let sec = time % 60;
    format!("{y:04}-{m:02}-{d:02}T{hour:02}:{min:02}:{sec:02}Z")
}

fn sweep_temp() -> usize {
    let Some(dir) = crate::cleanup::env_dir("TEMP") else {
        return 0;
    };
    let Ok(entries) = fs::read_dir(&dir) else {
        return 0;
    };
    let mut count = 0;
    for entry in entries.flatten() {
        let p = entry.path();
        let s = p.to_string_lossy().to_string();
        if crate::cleanup::delete_path(&s).is_ok() {
            count += 1;
        }
    }
    count
}

fn sweep_caches() -> usize {
    // Anything under LocalAppData that is itself named "Cache" (or "Caches")
    // is fair game. Two levels deep so we catch `app/Cache` patterns.
    let Some(root) = crate::cleanup::env_dir("LOCALAPPDATA") else {
        return 0;
    };
    let mut count = 0;
    let Ok(top) = fs::read_dir(&root) else {
        return 0;
    };
    for app in top.flatten() {
        let app_path = app.path();
        if !app_path.is_dir() {
            continue;
        }
        let Ok(children) = fs::read_dir(&app_path) else {
            continue;
        };
        for child in children.flatten() {
            let child_path = child.path();
            let name = child_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if name == "cache" || name == "caches" || name == "code cache" {
                let s = child_path.to_string_lossy().to_string();
                if crate::cleanup::delete_path(&s).is_ok() {
                    count += 1;
                }
            }
        }
    }
    count
}

/// Empty the user's Recycle Bin. Uses the Shell API via PowerShell so we don't
/// pull in a new Win32 binding just for this one call.
fn empty_recycle_bin() -> Result<(), String> {
    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Clear-RecycleBin -Force -ErrorAction SilentlyContinue",
        ])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("powershell exited with {}", status.code().unwrap_or(-1)))
    }
}
