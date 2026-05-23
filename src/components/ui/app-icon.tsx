/**
 * App icon with a quiet monogram fallback. Shows the real extracted icon when
 * one is available, otherwise the app's first letter on a neutral surface so
 * rows stay aligned and legible without introducing decorative colour.
 */
export function AppIcon({ name, src }: { name: string; src?: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md">
      {src ? (
        <img src={src} alt="" draggable={false} className="h-7 w-7 object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-surface-active text-xs font-semibold text-text-muted">
          {letter}
        </div>
      )}
    </div>
  );
}
