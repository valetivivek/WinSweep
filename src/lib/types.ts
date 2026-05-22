/* Shared domain types. These mirror the shapes the Rust commands will return,
   so the UI can be built against mocks now and wired to invoke() later. */

export type PageId = "installed" | "updates" | "cleanup";

export interface InstalledApp {
  id: string;
  name: string;
  publisher: string;
  version: string;
  /** Size on disk in bytes. Null when the size could not be determined. */
  sizeBytes: number | null;
  /** ISO 8601 date string, or null when unknown. */
  installDate: string | null;
  /** Absolute install location, used by "open file location". */
  installLocation: string | null;
}

export interface AppUpdate {
  id: string;
  name: string;
  publisher: string;
  currentVersion: string;
  availableVersion: string;
}

export type UpdateStatus = "idle" | "updating" | "done" | "failed";

export type ResidualKind = "folder" | "file" | "registry";

export type ResidualLocation =
  | "AppData"
  | "LocalAppData"
  | "ProgramData"
  | "Temp"
  | "Registry";

export interface ResidualItem {
  id: string;
  /** App or vendor the leftover is associated with. */
  relatedTo: string;
  kind: ResidualKind;
  location: ResidualLocation;
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
