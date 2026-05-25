/* Shared domain types. These mirror the shapes the Rust commands will return,
   so the UI can be built against mocks now and wired to invoke() later. */

export type PageId = "installed" | "updates" | "cleanup" | "app-data" | "settings";

export interface AppDataEntry {
  id: string;
  /** Display name of the installed app this folder belongs to. */
  relatedTo: string;
  /** "AppData" | "LocalAppData" | "ProgramData". */
  location: "AppData" | "LocalAppData" | "ProgramData";
  path: string;
  sizeBytes: number;
  /** Last-modified time as Unix seconds, or null when unreadable. */
  lastModifiedUnix: number | null;
}

export interface AppDataDeleteReport {
  deletedPaths: string[];
  errors: string[];
}

export interface ScheduleConfig {
  enabled: boolean;
  /** "MON" through "SUN" — matches schtasks /D values exactly. */
  dayOfWeek: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
  hour: number;
  minute: number;
  cleanTemp: boolean;
  cleanRecycleBin: boolean;
  cleanCaches: boolean;
}

export interface ScheduleResult {
  success: boolean;
  message: string;
}

export interface QuickSweepReport {
  tempItems: number;
  recycleBinEmptied: boolean;
  cacheItems: number;
  /** Human-readable summary, safe to show in a sidebar inline note. */
  message: string;
}

export interface InstalledApp {
  id: string;
  name: string;
  publisher: string;
  version: string;
  /** Optional app description from installer metadata. Null when unavailable. */
  description: string | null;
  /** Optional app category from installer metadata. Null when unavailable. */
  category: string | null;
  /** Size on disk in bytes. Null when the size could not be determined. */
  sizeBytes: number | null;
  /** ISO 8601 date string, or null when unknown. */
  installDate: string | null;
  /** ISO 8601 date string, or null when Windows does not expose reliable data. */
  lastUsedAt: string | null;
  /** Absolute install location, used by "open file location". */
  installLocation: string | null;
}

export interface AppUpdate {
  id: string;
  name: string;
  publisher: string;
  currentVersion: string;
  availableVersion: string;
  /** Where the upgrade comes from: "winget", "msstore", or another source. */
  source: string;
}

export type UpdateStatus = "idle" | "updating" | "done" | "failed";

export interface WindowsUpdate {
  id: string;
  title: string;
  /** "KBxxxxxxx" when WUA exposes one, empty string otherwise. */
  kb: string;
  sizeBytes: number;
  /** "Critical" | "Important" | "Moderate" | "Low" | "" from MSRC. */
  severity: string;
}

export type ResidualKind = "folder" | "file" | "registry";

export type ResidualLocation =
  | "AppData"
  | "LocalAppData"
  | "ProgramData"
  | "Temp"
  | "Registry";

/** Heuristic classification of what a leftover *is*, independent of where it
 * lives. Lets the UI group "logs across every app" or "all caches" instead of
 * making the user read paths. */
export type ResidualCategory =
  | "Logs"
  | "Cache"
  | "Config"
  | "Data"
  | "Crashes"
  | "Installer"
  | "Other";

export interface ResidualItem {
  id: string;
  /** App or vendor the leftover is associated with. */
  relatedTo: string;
  kind: ResidualKind;
  location: ResidualLocation;
  category: ResidualCategory;
  /** Full path or registry key. */
  path: string;
  /** Reclaimable size in bytes. Registry keys report 0. */
  sizeBytes: number;
}

export interface DeleteReport {
  /** Ids that were successfully removed. */
  deletedIds: string[];
  /** Human-readable failures, one per item that could not be removed. */
  errors: string[];
}
