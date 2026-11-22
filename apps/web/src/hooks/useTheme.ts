import { useCallback, useState } from "react";
import { writeStorage } from "../lib/storage";

export type Theme = "light" | "dark";

/** Must match the inline script in index.html. */
const STORAGE_KEY = "runway.theme";

const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    writeStorage(STORAGE_KEY, next);
    setTheme(next);
  }, []);

  return { theme, toggle };
}
