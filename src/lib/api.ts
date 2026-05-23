import { invoke } from "@tauri-apps/api/core";
import type { AppUpdate, DeleteReport, InstalledApp, ResidualItem } from "./types";
import { MOCK_INSTALLED_APPS, MOCK_RESIDUALS, MOCK_UPDATES } from "./mock-data";

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

export async function updateApp(id: string): Promise<void> {
  if (!isTauri()) {
    await delay(1100 + Math.random() * 900);
    return;
  }
  await invoke("update_app", { id });
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
