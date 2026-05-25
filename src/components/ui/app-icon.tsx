export function AppIcon({ name, src }: { name: string; src?: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-surface-active"
      style={{
        borderRadius: "28%",
        boxShadow: "inset 0 0 0 1px var(--border), inset 0 1px 2px rgba(0, 0, 0, 0.06)",
      }}
    >
      {src ? (
        <img src={src} alt="" draggable={false} className="h-7 w-7 object-contain" />
      ) : (
        <span className="text-xs font-semibold text-text-muted">{letter}</span>
      )}
    </div>
  );
}
