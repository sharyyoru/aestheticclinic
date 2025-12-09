"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (pathname === "/login") {
      setChecking(false);
      return;
    }

    let isMounted = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (!data.session) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-xs text-slate-500">
        Checking your session...
      </div>
    );
  }

  return <>{children}</>;
}
