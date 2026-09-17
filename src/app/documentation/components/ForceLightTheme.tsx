"use client";

import { useEffect } from "react";

/**
 * The app's ThemeProvider puts `.dark` on <html> on every route (dark is the
 * default), and globals.css overrides card backgrounds under `.dark`. The public
 * documentation is always light, so the class is removed while docs pages are
 * mounted and restored on the way out.
 */
export default function ForceLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");

    const observer = new MutationObserver(() => {
      if (html.classList.contains("dark")) html.classList.remove("dark");
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      if (wasDark) html.classList.add("dark");
    };
  }, []);

  return null;
}
