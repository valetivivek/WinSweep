import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Check, Download, Loader2, RotateCw } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { listUpdates, updateApp } from "../lib/api";
import type { AppUpdate, UpdateStatus } from "../lib/types";
import { cn } from "../lib/utils";

export function UpdatesPage() {
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, UpdateStatus>>({});

  async function load() {
    setLoading(true);
    setError(null);
    setStatuses({});
    try {
      setUpdates(await listUpdates());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(
    () => updates.filter((u) => statuses[u.id] !== "done"),
    [updates, statuses],
  );
  const busy = Object.values(statuses).some((s) => s === "updating");

  const update = useCallback(async (id: string) => {
    setStatuses((s) => ({ ...s, [id]: "updating" }));
    try {
      await updateApp(id);
      setStatuses((s) => ({ ...s, [id]: "done" }));
    } catch {
      setStatuses((s) => ({ ...s, [id]: "failed" }));
    }
  }, []);

  const updateAll = useCallback(async () => {
    // Sequential, mirroring how winget processes upgrades one at a time.
    for (const u of updates) {
      if (statuses[u.id] === "done" || statuses[u.id] === "updating") continue;
      await update(u.id);
    }
  }, [updates, statuses, update]);

  const allDone = !loading && pending.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Maintenance"
        title="Updates"
        subtitle={
          loading
            ? "Checking for updates via winget..."
            : allDone
              ? "Everything is up to date"
              : `${pending.length} update${pending.length === 1 ? "" : "s"} available`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={load} disabled={loading || busy}>
              <RotateCw size={15} className={loading ? "animate-spin" : undefined} />
              Check again
            </Button>
            {!loading && !allDone && (
              <Button variant="primary" onClick={updateAll} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Update all
              </Button>
            )}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <LoadingState />
        ) : allDone ? (
          <AllUpToDate />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {updates.map((u, i) => (
              <UpdateRow
                key={u.id}
                update={u}
                status={statuses[u.id] ?? "idle"}
                divided={i > 0}
                index={i}
                onUpdate={() => update(u.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function UpdateRow({
  update,
  status,
  divided,
  index,
  onUpdate,
}: {
  update: AppUpdate;
  status: UpdateStatus;
  divided: boolean;
  index: number;
  onUpdate: () => void;
}) {
  const updating = status === "updating";

  return (
    <li
      style={{ "--i": index } as CSSProperties}
      className={cn(
        "ws-row relative flex items-center gap-4 px-4 py-3 transition-colors duration-150",
        status !== "done" && "hover:bg-surface-hover",
        divided && "border-t border-border",
        status === "done" && "opacity-60",
      )}
    >
      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{update.name}</div>
        <div className="truncate text-xs text-text-muted">{update.publisher}</div>
      </div>

      {/* Version transition */}
      <div className="hidden items-center gap-2 text-xs tabular-nums text-text-muted sm:flex">
        <span>v{update.currentVersion || "?"}</span>
        <ArrowRight size={13} className="text-text-faint" />
        <span className="font-medium text-text">v{update.availableVersion}</span>
      </div>

      {/* Action / status */}
      <div className="flex w-32 shrink-0 justify-end">
        {status === "done" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <Check size={15} />
            Updated
          </span>
        ) : status === "failed" ? (
          <Button variant="default" size="sm" onClick={onUpdate} className="text-danger">
            <RotateCw size={14} />
            Retry
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={onUpdate} disabled={updating}>
            {updating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Updating
              </>
            ) : (
              "Update"
            )}
          </Button>
        )}
      </div>

      {/* Inline progress bar while updating */}
      {updating && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
          <span className="block h-full w-1/3 animate-[ws-indeterminate_1.2s_ease-in-out_infinite] bg-accent" />
        </span>
      )}
    </li>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Loader2 size={24} className="animate-spin text-accent" />
      <p className="mt-4 text-sm text-text-muted">Asking winget what is out of date</p>
    </div>
  );
}

function AllUpToDate() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check size={22} strokeWidth={2.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-text">All software is up to date</p>
      <p className="mt-1 text-xs text-text-muted">
        WinSweep will check again next time you open this page.
      </p>
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
