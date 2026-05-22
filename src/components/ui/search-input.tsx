import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 " +
          "transition-colors duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40",
        className,
      )}
    >
      <Search size={15} className="shrink-0 text-text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="shrink-0 text-text-faint transition-colors hover:text-text"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
