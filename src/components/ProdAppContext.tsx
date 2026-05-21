"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ProdAppContextType = {
  isAppMode: boolean;
  setAppMode: (value: boolean) => void;
};

const ProdAppContext = createContext<ProdAppContextType>({
  isAppMode: false,
  setAppMode: () => {},
});

export function ProdAppProvider({ children }: { children: ReactNode }) {
  const [isAppMode, setIsAppMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check sessionStorage on mount
    const stored = sessionStorage.getItem("prodapp_mode");
    if (stored === "true") {
      setIsAppMode(true);
    }
    setMounted(true);
  }, []);

  const setAppMode = (value: boolean) => {
    setIsAppMode(value);
    if (value) {
      sessionStorage.setItem("prodapp_mode", "true");
    } else {
      sessionStorage.removeItem("prodapp_mode");
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ProdAppContext.Provider value={{ isAppMode, setAppMode }}>
      {children}
    </ProdAppContext.Provider>
  );
}

export function useProdApp() {
  return useContext(ProdAppContext);
}
