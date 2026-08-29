"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLayoutMode } from "./LayoutModeContext";
import { useProdApp } from "./ProdAppContext";
import BlizzardShell from "./blizzard/BlizzardShell";
import RequireAuth from "./RequireAuth";

// Routes that should bypass both shells entirely (standalone pages)
const STANDALONE_ROUTES = ["/login", "/demo", "/book-appointment", "/intake", "/onboarding", "/invoice/pay", "/consultations", "/embed", "/form", "/aliicechat", "/aliicechatembed", "/pricing", "/pricingaliice", "/appx", "/prodapp", "/patientapp", "/aliicestory", "/test-retell"];

function isStandaloneRoute(pathname: string): boolean {
  return STANDALONE_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"));
}

export default function LayoutShellSwitch({ children, classicShell }: { children: ReactNode; classicShell: ReactNode }) {
  const pathname = usePathname();
  const { mode } = useLayoutMode();
  const { isAppMode } = useProdApp();

  // Standalone routes: render children directly (no shell)
  if (isStandaloneRoute(pathname)) {
    return <>{children}</>;
  }

  // ProdApp mobile mode: use classic shell (handled by ProdAppHeader already)
  if (isAppMode) {
    return <>{classicShell}</>;
  }

  // Blizzard mode
  if (mode === "blizzard") {
    return (
      <RequireAuth>
        <BlizzardShell>{children}</BlizzardShell>
      </RequireAuth>
    );
  }

  // Classic mode
  return <>{classicShell}</>;
}
