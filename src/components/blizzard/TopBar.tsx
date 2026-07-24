"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LogoDropdown from "./LogoDropdown";
import ThemeToggle from "../ThemeToggle";
import HeaderNotificationsButton from "../HeaderNotificationsButton";
import HeaderDealNotificationsButton from "../HeaderDealNotificationsButton";
import HeaderEmailReportsButton from "../HeaderEmailReportsButton";
import HeaderInsuranceEmailButton from "../HeaderInsuranceEmailButton";
import HeaderCommentsButton from "../HeaderCommentsButton";
import HeaderTasksButton from "../HeaderTasksButton";
import HeaderWhatsAppButton from "../HeaderWhatsAppButton";
import HeaderUser from "../HeaderUser";

const NAV_ITEMS = [
  { label: "HOME", href: "/" },
  { label: "AGENDA", href: "/appointments" },
  { label: "DEALS", href: "/deals" },
  { label: "PATIENTS", href: "/patients" },
];

export default function TopBar() {
  const pathname = usePathname();
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="flex h-12 items-center justify-between border-b border-slate-700/50 bg-[#1e2433] px-4 relative z-50">
      {/* Left section: Logo + nav */}
      <div className="flex items-center gap-4">
        {/* Logo with dropdown trigger + silver gradient pill */}
        <div className="relative">
          <button
            onClick={() => setLogoMenuOpen(!logoMenuOpen)}
            className="flex items-center gap-1.5 group"
          >
            {/* Silver gradient pill behind the logo */}
            <span className="flex items-center rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 px-3 py-1.5 shadow-sm">
              <Image
                src="/logos/aesthetics-logo.svg"
                alt="Clinic logo"
                width={90}
                height={28}
                className="h-6 w-auto"
              />
            </span>
            <svg
              className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${logoMenuOpen ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {logoMenuOpen && <LogoDropdown onClose={() => setLogoMenuOpen(false)} />}
        </div>

        {/* Back / Forward */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => window.history.back()}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => window.history.forward()}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Main nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors rounded ${
                isActive(item.href)
                  ? "text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="block h-0.5 mt-0.5 rounded-full bg-sky-400" />
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Right section: notifications, theme, user */}
      <div className="flex items-center gap-1">
        <HeaderTasksButton />
        <HeaderDealNotificationsButton />
        <HeaderEmailReportsButton />
        <HeaderInsuranceEmailButton />
        <HeaderNotificationsButton />
        <HeaderCommentsButton />
        <HeaderWhatsAppButton />
        <ThemeToggle />
        <HeaderUser />
      </div>
    </header>
  );
}
