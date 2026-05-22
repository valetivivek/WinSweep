import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  Database,
  File as FileIcon,
  Folder,
  Loader2,
  RotateCw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { deleteResiduals, scanResiduals } from "../lib/api";
import type { ResidualItem, ResidualKind, ResidualLocation } from "../lib/types";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/utils";

type ScanState = "scanning" | "results";

const SCAN_TARGETS: ResidualLocation[] = [
  "AppData",
  "LocalAppData",
  "ProgramData",
  "Temp",
  "Registry",
];

const KIND_ICON: Record<ResidualKind, typeof Folder> = {
  folder: Folder,
  file: FileIcon,
  registry: Database,
};

export function CleanupPage() {
  const [state, setState] = useState<ScanState>("scanning");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResidualItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interval = useRef<number | null>(null);

  // Auto-scan on open, per the design brief. Re-runnable via "Scan again".
  async function startScan() {
    if (interval.current) window.clearInterval(interval.current);
    setState("scanning");
    setProgress(0);
    setResults([]);
    setSelected(new Set());
    setError(null);

    // Drive an indeterminate-feeling progress bar up to 90% while we wait, so
    // the scan never looks stalled regardless of how long the backend takes.
    interval.current = window.setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(1, Math.round((90 - p) / 8))));
    }, 90);

    try {
      const items = await scanResiduals();
      setResults(items);
    } catch (e) {
      setError(String(e));
      setResults([]);
    } finally {
      if (interval.current) window.clearInterval(interval.current);
      setProgress(100);
      // Brief beat at 100% before revealing results.
      window.setTimeout(() => setState("results"), 180);
    }
  }

  useEffect(() => {
    startScan();
    return () => {
      if (interval.current) window.clearInterval(interval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalReclaimable = useMemo(
    () => results.filter((r) => selected.has(r.id)).reduce((sum, r) => sum + r.sizeBytes, 0),
    [results, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === results.length ? new Set() : new Set(results.map((r) => r.id)),
    );
  }

  async function confirmDelete() {
    setConfirming(false);
    setDeleting(true);
    setError(null);
    const targets = results.filter((r) => selected.has(r.id));
    try {
      const report = await deleteResiduals(targets);
      const removed = new Set(report.deletedIds);
      setResults((prev) => prev.filter((r) => !removed.has(r.id)));
      setSelected(new Set());
      if (report.errors.length > 0) {
        setError(`${report.errors.length} item(s) could not be removed: ${report.errors[0]}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = results.length > 0 && selected.size === results.length;

  return (
    <>
      <PageHeader
        eyebrow="Reclaim Space"
        title="Cleanup"
        subtitle={
          state === "scanning"
            ? "Scanning for leftover files and registry keys"
            : results.length === 0
              ? "No residual files found"
              : `${results.length} leftover item${results.length === 1 ? "" : "s"} found · ${formatBytes(
                  results.reduce((sum, r) => sum + r.sizeBytes, 0),
                )} reclaimable`
        }
        actions={
          state === "results" && (
            <Button variant="default" onClick={startScan} disabled={deleting}>
              <RotateCw size={15} />
              Scan again
            </Button>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col px-8 pb-8">
        {error && <ErrorBanner message={error} />}
        {state === "scanning" ? (
          <Scanning progress={progress} />
        ) : results.length === 0 ? (
          <Spotless />
        ) : (
          <>
            {/* Review toolbar */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs font-medium text-text-muted transition-colors hover:text-text"
              >
                <Checkbox checked={allSelected} indeterminate={!allSelected && selected.size > 0} />
                {allSelected ? "Deselect all" : "Select all"}
                <span className="text-text-faint">
                  ({selected.size} of {results.length})
                </span>
              </button>
              <Button
                variant="danger"
                size="sm"
                disabled={selected.size === 0 || deleting}
                onClick={() => setConfirming(true)}
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Delete selected ({formatBytes(totalReclaimable)})
              </Button>
            </div>

            {/* Results */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                {results.map((item, i) => (
                  <ResidualRow
                    key={item.id}
                    item={item}
                    checked={selected.has(item.id)}
                    divided={i > 0}
                    index={i}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete ${selected.size} item${selected.size === 1 ? "" : "s"}?`}
          message={
            <>
              This permanently removes the selected files, folders, and registry keys, reclaiming{" "}
              {formatBytes(totalReclaimable)}. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function ResidualRow({
  item,
  checked,
  divided,
  index,
  onToggle,
}: {
  item: ResidualItem;
  checked: boolean;
  divided: boolean;
  index: number;
  onToggle: () => void;
}) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
      className={cn(
        "ws-row group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover",
        divided && "border-t border-border",
      )}
      onClick={onToggle}
    >
      <Checkbox checked={checked} />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-text-muted">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{item.relatedTo}</div>
        <div className="truncate font-mono text-xs text-text-muted">{item.path}</div>
      </div>
      <LocationBadge location={item.location} />
      <div className="w-16 shrink-0 text-right text-xs tabular-nums text-text-muted">
        {item.kind === "registry" ? "key" : formatBytes(item.sizeBytes)}
      </div>
    </li>
  );
}

function LocationBadge({ location }: { location: ResidualLocation }) {
  return (
    <span className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint sm:inline">
      {location}
    </span>
  );
}

function Checkbox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150",
        checked || indeterminate
          ? "border-accent bg-accent text-accent-contrast"
          : "border-border-strong bg-surface",
      )}
    >
      {checked && <Check size={12} strokeWidth={3} />}
      {!checked && indeterminate && <span className="h-0.5 w-2 rounded-full bg-accent-contrast" />}
    </span>
  );
}

function Scanning({ progress }: { progress: number }) {
  const activeIndex = Math.min(
    SCAN_TARGETS.length - 1,
    Math.floor((progress / 100) * SCAN_TARGETS.length),
  );
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <Loader2 size={28} className="animate-spin text-accent" />
      <p className="mt-5 text-sm font-medium text-text">Scanning your system</p>
      <p className="mt-1 text-xs text-text-muted">
        Checking {SCAN_TARGETS[activeIndex]} for leftover files
      </p>
      <div className="mt-6 h-1 w-64 overflow-hidden rounded-full bg-surface-active">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Spotless() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check size={22} strokeWidth={2.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-text">Nothing to clean up</p>
      <p className="mt-1 text-xs text-text-muted">No residual files were left behind. Nice and tidy.</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}
