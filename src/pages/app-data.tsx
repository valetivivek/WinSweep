import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ExternalLink, FolderOpen, Loader2, RotateCw, Trash2 } from "lucide-react";
import { HeroChip, PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { SearchInput } from "../components/ui/search-input";
import { SkeletonRows } from "../components/ui/skeleton";
import { deleteAppData, listAppData, openAppData } from "../lib/api";
import type { AppDataEntry } from "../lib/types";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/utils";

type SortKey = "size" | "name" | "modified";

export function AppDataPage() {
  const [entries, setEntries] = useState<AppDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("size");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAppData();
      setEntries(data);
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    const filtered = entries.filter((e) => {
      if (terms.length === 0) return true;
      const hay = `${e.relatedTo} ${e.location} ${e.path}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const sorted = [...filtered];
    if (sort === "size") sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
    if (sort === "name") sorted.sort((a, b) => a.relatedTo.localeCompare(b.relatedTo));
    if (sort === "modified") {
      sorted.sort((a, b) => (b.lastModifiedUnix ?? 0) - (a.lastModifiedUnix ?? 0));
    }
    return sorted;
  }, [entries, query, sort]);

  const totalBytes = useMemo(
    () => entries.reduce((s, e) => s + e.sizeBytes, 0),
    [entries],
  );

  const selectedBytes = useMemo(
    () => visible.filter((e) => selected.has(e.id)).reduce((s, e) => s + e.sizeBytes, 0),
    [visible, selected],
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((e) => selected.has(e.id));
  const someVisibleSelected =
    visible.some((e) => selected.has(e.id)) && !allVisibleSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const ids = visible.map((e) => e.id);
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        allSelected ? next.delete(id) : next.add(id);
      }
      return next;
    });
  }

  async function confirmDelete() {
    setConfirming(false);
    setDeleting(true);
    setError(null);
    const targets = entries.filter((e) => selected.has(e.id));
    try {
      const report = await deleteAppData(targets.map((t) => t.path));
      const removed = new Set(report.deletedPaths);
      setEntries((prev) => prev.filter((e) => !removed.has(e.path)));
      setSelected(new Set());
      if (report.errors.length > 0) {
        setError(`${report.errors.length} folder(s) could not be removed: ${report.errors[0]}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="App Data"
        title="App Data"
        subtitle={
          loading
            ? "Scanning AppData and ProgramData for known apps"
            : `${entries.length} folder${entries.length === 1 ? "" : "s"} · ${formatBytes(totalBytes)} total`
        }
        hero={{
          metric: loading ? "--" : entries.length.toString(),
          label: "AppData · Live",
          chips: (
            <>
              <HeroChip>{loading ? "Scanning" : `${visible.length} visible`}</HeroChip>
              {!loading && <HeroChip>{formatBytes(totalBytes)}</HeroChip>}
            </>
          ),
        }}
        actions={
          <Button variant="default" onClick={load} disabled={loading || deleting}>
            <RotateCw size={15} className={loading ? "animate-spin" : undefined} />
            Rescan
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col px-8 pb-8">
        {error && (
          <div className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="ws-membrane overflow-hidden rounded-lg bg-surface">
            <SkeletonRows count={8} />
          </div>
        ) : entries.length === 0 ? (
          <Empty />
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by app, path..."
                className="w-full lg:max-w-xl"
              />
              <div className="flex items-center gap-3">
                <SortToggle value={sort} onChange={setSort} />
                <Button
                  variant="danger"
                  size="sm"
                  disabled={selected.size === 0 || deleting}
                  onClick={() => setConfirming(true)}
                >
                  {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  Recycle selected ({formatBytes(selectedBytes)})
                </Button>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 text-xs text-text-faint">
              <button
                onClick={toggleAllVisible}
                disabled={visible.length === 0}
                className="flex items-center gap-2 text-xs font-medium text-text-muted hover:text-text"
              >
                <Checkbox checked={allVisibleSelected} indeterminate={someVisibleSelected} />
                {allVisibleSelected ? "Deselect shown" : "Select shown"}
                <span className="text-text-faint">({selected.size} selected)</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="ws-membrane overflow-hidden rounded-lg bg-surface">
                {visible.map((entry, i) => (
                  <AppDataRow
                    key={entry.id}
                    entry={entry}
                    index={i}
                    divided={i > 0}
                    checked={selected.has(entry.id)}
                    onToggle={() => toggle(entry.id)}
                    onOpen={() => openAppData(entry.path)}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Move ${selected.size} folder${selected.size === 1 ? "" : "s"} to the Recycle Bin?`}
          message={
            <>
              These folders contain data for installed apps. Moving them frees{" "}
              {formatBytes(selectedBytes)} but the apps may lose preferences, logins, and saved
              state. Items go to the Recycle Bin so you can restore them if needed.
            </>
          }
          confirmLabel="Move to Recycle Bin"
          onConfirm={confirmDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function AppDataRow({
  entry,
  index,
  divided,
  checked,
  onToggle,
  onOpen,
}: {
  entry: AppDataEntry;
  index: number;
  divided: boolean;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <li
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={checked}
      aria-label={`${checked ? "Deselect" : "Select"} ${entry.relatedTo}`}
      className={cn(
        "ws-row ws-vein group relative flex cursor-pointer items-center gap-6 px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
        divided && "border-t border-border",
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <Checkbox checked={checked} />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-text-muted">
        <FolderOpen size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{entry.relatedTo}</div>
        <div className="truncate font-mono text-xs text-text-muted">{entry.path}</div>
      </div>
      <span className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint sm:inline">
        {entry.location}
      </span>
      <div className="w-24 shrink-0 text-left text-xs tabular-nums text-text-muted">
        {formatModified(entry.lastModifiedUnix)}
      </div>
      <div className="w-20 shrink-0 text-left text-xs tabular-nums text-text-muted">
        {formatBytes(entry.sizeBytes)}
      </div>
      <button
        type="button"
        title="Open in Explorer"
        aria-label={`Open ${entry.relatedTo} in Explorer`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center bg-gradient-to-l from-surface-hover via-surface-hover to-transparent pl-12 pr-1 text-text-faint opacity-0 transition-[opacity,color] hover:text-text group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none"
      >
        <ExternalLink size={15} />
      </button>
    </li>
  );
}

function SortToggle({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const options: { value: SortKey; label: string }[] = [
    { value: "size", label: "Size" },
    { value: "name", label: "Name" },
    { value: "modified", label: "Recent" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2.5 py-1 transition-colors",
            value === opt.value
              ? "bg-accent text-accent-foreground"
              : "text-text-muted hover:text-text",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function formatModified(unix: number | null): string {
  if (!unix) return "--";
  const ms = unix * 1000;
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Empty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span className="ws-living-dot mb-4 h-2 w-2 rounded-full bg-accent" />
      <p className="text-sm font-medium text-text">No app data folders found</p>
      <p className="mt-1 max-w-md text-xs text-text-muted">
        WinSweep could not match any installed app to a folder under AppData or ProgramData.
      </p>
    </div>
  );
}
