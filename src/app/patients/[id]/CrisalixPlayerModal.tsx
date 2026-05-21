"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type ReconstructionType = "breast" | "face" | "body";

declare global {
  interface Window {
    CrisalixPlayer?: new (token: string) => {
      render: (mode: "surgeon" | "patient", options: Record<string, unknown>) => void;
    };
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift() ?? null;
  return null;
}

const CRISALIX_PLAYER_SCRIPT_URL = `${(process.env.CRISALIX_API_BASE_URL ?? "https://api3d-staging.crisalix.com").replace(/\/$/, "")}/v2/player.js`;

let playerScriptLoading: Promise<void> | null = null;

function loadPlayerScriptOnce(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.CrisalixPlayer) return Promise.resolve();

  if (!playerScriptLoading) {
    playerScriptLoading = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src='${CRISALIX_PLAYER_SCRIPT_URL}']`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Failed to load player.js")));
        return;
      }

      const script = document.createElement("script");
      script.src = CRISALIX_PLAYER_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load player.js"));
      document.body.appendChild(script);
    });
  }

  return playerScriptLoading;
}

export default function CrisalixPlayerModal({
  patientId,
  open,
  playerId,
  reconstructionType,
}: {
  patientId: string;
  open: boolean;
  playerId: string | null;
  reconstructionType: ReconstructionType | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !playerId || !reconstructionType || !mounted) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        console.log("[Crisalix Player] Starting initialization...");
        
        await loadPlayerScriptOnce();
        if (cancelled || !window.CrisalixPlayer) {
          console.error("[Crisalix Player] Player script not loaded");
          return;
        }

        const token = getCookie("crisalix_player_token");
        console.log("[Crisalix Player] Token present:", !!token);
        
        if (!token) {
          console.error("[Crisalix Player] No player token found in cookies");
          setLoading(false);
          return;
        }

        const PlayerCtor = window.CrisalixPlayer;
        const player = new PlayerCtor(token);
        console.log("[Crisalix Player] Player instance created");

        const container = containerRef.current;
        if (!container) return;

        const reconstruction_type =
          reconstructionType === "breast"
            ? "mammo"
            : reconstructionType === "face"
              ? "face"
              : "body";

        const options: Record<string, unknown> = {
          container,
          reconstruction_type,
          player_id: playerId,
          locale: "en",
          autoplay: true,
        };

        console.log("[Crisalix Player] Rendering with options:", options);
        player.render("surgeon", options);
        console.log("[Crisalix Player] Render called successfully");
        
        if (!cancelled) {
          setLoading(false);
        }
      } catch (error) {
        console.error("[Crisalix Player] Error during initialization:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [open, playerId, reconstructionType, mounted]);

  if (!open || !playerId || !reconstructionType || !mounted) {
    return null;
  }

  function handleClose() {
    router.push(`/patients/${patientId}?mode=medical`);
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950 text-slate-50">
      <div ref={containerRef} className="h-[100dvh] w-[100dvw]" />

      <button
        type="button"
        onClick={handleClose}
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/80 text-slate-200 shadow-lg ring-1 ring-white/15 backdrop-blur hover:bg-slate-800 hover:text-white"
        aria-label="Close 3D player"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80">
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-[11px] font-medium text-slate-200">
            Generating 3D simulation...
          </p>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
