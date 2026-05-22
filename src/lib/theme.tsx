import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_MODE = "winsweep.theme.mode";

const ThemeContext = createContext<ThemeState | null>(null);

function readMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_MODE);
  if (stored === "light" || stored === "dark") return stored;
  return "light"; // brief: light mode is the default
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    localStorage.setItem(STORAGE_MODE, mode);
  }, [mode]);

  const value: ThemeState = {
    mode,
    toggleMode: () => setModeState((m) => (m === "light" ? "dark" : "light")),
    setMode: setModeState,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
