"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

// Routes that should be completely standalone (no sidebar, header, or shell)
const STANDALONE_ROUTES = ["/login", "/book-appointment", "/intake", "/onboarding", "/invoice/pay", "/consultations", "/embed", "/form", "/aliicechat", "/aliicechatembed", "/pricing", "/appx"];

// Routes that should have transparent/minimal background (for iframe embedding)
const TRANSPARENT_ROUTES = ["/embed", "/aliicechatembed"];

function isStandaloneRoute(pathname: string): boolean {
  return STANDALONE_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"));
}

function isTransparentRoute(pathname: string): boolean {
  return TRANSPARENT_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"));
}

export function ShellBackground({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Embed routes get transparent background with no padding
  if (isTransparentRoute(pathname)) {
    return (
      <div className="min-h-screen bg-transparent">
        {children}
      </div>
    );
  }
  
  // Regular routes get the gradient background with padding
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff,_#e0f2fe_40%,_#fdf2ff_80%)] px-4 py-6 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

export function ShellSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isStandaloneRoute(pathname)) {
    return null;
  }
  return <>{children}</>;
}

export function ShellHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isStandaloneRoute(pathname)) {
    return null;
  }
  return <>{children}</>;
}

export function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Standalone pages render without any shell wrapper
  if (isStandaloneRoute(pathname)) {
    return <>{children}</>;
  }

  if (pathname === "/appointments") {
    return (
      <div className="min-h-[80vh] w-full overflow-x-hidden overflow-y-auto mx-[-1rem] sm:mx-[-1.5rem] lg:mx-[-2rem]">
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1614px] min-h-[80vh] overflow-x-hidden overflow-y-auto rounded-3xl border border-white/60 bg-white/80 shadow-[0_22px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      {children}
    </div>
  );
}
