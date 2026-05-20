"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Routes that should not show the global loader (embedded pages)
const LOADER_HIDDEN_ROUTES = ["/embed", "/aliicechatembed"];

function isLoaderHiddenRoute(pathname: string): boolean {
  return LOADER_HIDDEN_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"));
}

export default function GlobalLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Don't show loader for embedded routes
    if (isLoaderHiddenRoute(pathname)) return;
    
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Never show on embed routes
  if (isLoaderHiddenRoute(pathname)) return null;
  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
        </div>
        <p className="text-sm font-medium text-slate-600 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
