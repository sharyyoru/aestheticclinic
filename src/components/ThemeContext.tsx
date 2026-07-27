"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLayoutMode } from "./LayoutModeContext";

type Theme = "dark" | "light";
type PlaceholderVisibility = "visible" | "hidden";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  placeholderVisibility: PlaceholderVisibility;
  setPlaceholderVisibility: (v: PlaceholderVisibility) => void;
  togglePlaceholderVisibility: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  placeholderVisibility: "visible",
  setPlaceholderVisibility: () => {},
  togglePlaceholderVisibility: () => {},
});

const STORAGE_KEY = "app_theme";
const PLACEHOLDER_KEY = "app_placeholder_visibility";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [placeholderVisibility, setPlaceholderVisibilityState] = useState<PlaceholderVisibility>("visible");
  const [mounted, setMounted] = useState(false);
  const { mode } = useLayoutMode();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
    }
    const storedPlaceholders = localStorage.getItem(PLACEHOLDER_KEY) as PlaceholderVisibility | null;
    if (storedPlaceholders === "visible" || storedPlaceholders === "hidden") {
      setPlaceholderVisibilityState(storedPlaceholders);
    }
    setMounted(true);
  }, []);

  // Apply/remove .dark class on <html> — only in blizzard mode
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    // Classic layout stays light always — dark mode only affects blizzard layout
    if (mode === "classic" || theme === "light") {
      html.classList.remove("dark");
    } else {
      html.classList.add("dark");
    }
  }, [theme, mounted, mode]);

  // Apply/remove .hide-placeholders class on <html>
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (placeholderVisibility === "hidden") {
      html.classList.add("hide-placeholders");
    } else {
      html.classList.remove("hide-placeholders");
    }
  }, [placeholderVisibility, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  const setPlaceholderVisibility = (v: PlaceholderVisibility) => {
    setPlaceholderVisibilityState(v);
    localStorage.setItem(PLACEHOLDER_KEY, v);
  };

  const togglePlaceholderVisibility = () => {
    setPlaceholderVisibility(placeholderVisibility === "hidden" ? "visible" : "hidden");
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, placeholderVisibility, setPlaceholderVisibility, togglePlaceholderVisibility }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
