"use client";

import { useEffect } from "react";

/**
 * ForceLightMode
 *
 * Public-facing pages (booking flow, embeds) were designed with a light theme.
 * The app's ThemeContext defaults to dark and adds a `.dark` class to <html>,
 * which causes globals.css dark-mode overrides to bleed into these pages
 * (black-on-black text, dark backgrounds, etc.).
 *
 * Rendering this component in a layout removes the `.dark` class for the
 * lifetime of that route and restores it on unmount so the admin app is
 * unaffected.
 */
export default function ForceLightMode() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");

    return () => {
      if (wasDark) {
        html.classList.add("dark");
      }
    };
  }, []);

  return null;
}
