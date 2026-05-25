import { invoke } from "@tauri-apps/api/core";
import type {
  AppDataDeleteReport,
  AppDataEntry,
  AppUpdate,
  DeleteReport,
  InstalledApp,
  QuickSweepReport,
  ResidualItem,
  ScheduleConfig,
  ScheduleResult,
  WindowsUpdate,
} from "./types";
import {
  MOCK_APP_DATA,
  MOCK_INSTALLED_APPS,
  MOCK_RESIDUALS,
  MOCK_SCHEDULE,
  MOCK_UPDATES,
} from "./mock-data";

/* The single boundary between the UI and the Rust backend. Every page goes
   through here. When the app runs inside Tauri we call real commands; in a
   plain browser (UI development / preview) we return mock data so the whole
   interface stays clickable without the backend. */

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Resolve after `ms`, used to give mock fallbacks lifelike timing. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listInstalledApps(): Promise<InstalledApp[]> {
  if (!isTauri()) {
    await delay(250);
    return MOCK_INSTALLED_APPS;
  }
  return invoke<InstalledApp[]>("list_installed_apps");
}

export async function uninstallApp(id: string): Promise<void> {
  if (!isTauri()) {
    await delay(400);
    return;
  }
  await invoke("uninstall_app", { id });
}

export async function openInstallLocation(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_install_location", { path });
}

/** Base64 PNG data URLs keyed by app id. Apps without a usable icon are omitted. */
export async function getAppIcons(ids: string[]): Promise<Record<string, string>> {
  if (!isTauri()) return {};
  return invoke<Record<string, string>>("app_icons", { ids });
}

export async function listUpdates(): Promise<AppUpdate[]> {
  if (!isTauri()) {
    await delay(400);
    return MOCK_UPDATES;
  }
  return invoke<AppUpdate[]>("list_updates");
}

export async function updateApp(id: string, source?: string): Promise<void> {
  if (!isTauri()) {
    await delay(1100 + Math.random() * 900);
    return;
  }
  await invoke("update_app", { id, source });
}

export async function listWindowsUpdates(): Promise<WindowsUpdate[]> {
  if (!isTauri()) {
    await delay(600);
    return [];
  }
  return invoke<WindowsUpdate[]>("list_windows_updates");
}

export async function openWindowsUpdateSettings(): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_windows_update_settings");
}

export async function scanResiduals(): Promise<ResidualItem[]> {
  if (!isTauri()) {
    await delay(700);
    return MOCK_RESIDUALS;
  }
  return invoke<ResidualItem[]>("scan_residuals");
}

export async function deleteResiduals(items: ResidualItem[]): Promise<DeleteReport> {
  if (!isTauri()) {
    await delay(500);
    return { deletedIds: items.map((i) => i.id), errors: [] };
  }
  return invoke<DeleteReport>("delete_residuals", { items });
}

/** Paths the user has chosen to permanently exclude from cleanup scans. */
export async function listIgnored(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("list_ignored");
}

export async function addIgnored(paths: string[]): Promise<void> {
  if (!isTauri()) return;
  await invoke("add_ignored", { paths });
}

export async function clearIgnored(): Promise<void> {
  if (!isTauri()) return;
  await invoke("clear_ignored");
}

export async function listAppData(): Promise<AppDataEntry[]> {
  if (!isTauri()) {
    await delay(450);
    return MOCK_APP_DATA;
  }
  return invoke<AppDataEntry[]>("list_app_data");
}

export async function deleteAppData(paths: string[]): Promise<AppDataDeleteReport> {
  if (!isTauri()) {
    await delay(400);
    return { deletedPaths: paths, errors: [] };
  }
  return invoke<AppDataDeleteReport>("delete_app_data", { paths });
}

export async function openAppData(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_app_data", { path });
}

export async function getSchedule(): Promise<ScheduleConfig> {
  if (!isTauri()) {
    await delay(150);
    return MOCK_SCHEDULE;
  }
  return invoke<ScheduleConfig>("get_schedule");
}

export async function setSchedule(config: ScheduleConfig): Promise<ScheduleResult> {
  if (!isTauri()) {
    await delay(250);
    return { success: true, message: config.enabled ? "Scheduled (mock)" : "Disabled (mock)" };
  }
  return invoke<ScheduleResult>("set_schedule", { cfg: config });
}

export async function getLastScheduledRun(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("get_last_scheduled_run");
}

export async function quickSweep(): Promise<QuickSweepReport> {
  if (!isTauri()) {
    await delay(900);
    return {
      tempItems: 42,
      recycleBinEmptied: true,
      cacheItems: 0,
      message: "Temp: 42 items; Recycle Bin emptied (mock)",
    };
  }
  return invoke<QuickSweepReport>("quick_sweep");
}
