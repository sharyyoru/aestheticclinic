"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLayoutMode } from "./LayoutModeContext";

type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = "app_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const { mode } = useLayoutMode();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
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

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
