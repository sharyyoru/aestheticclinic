"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Script from "next/script";

// Retell AI Configuration
const RETELL_PUBLIC_KEY = "key_19ba0b68c96753283f143e6dc1d8";
const RETELL_AGENT_ID = "agent_49322ed02ae4ea55665d81536c";
const AVATAR_URL = "https://aestheticclinic.vercel.app/logos/AliiceAgent.jpg";
const BOOK_URL = "https://aestheticclinic.vercel.app/book-appointment/location";
const CLINIC_PHONE = "+41 22 732 22 23";
const CLINIC_PHONE_TEL = "+41227322223";

export default function AliiceChatPage() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  // Inject global CSS once
  useEffect(() => {
    const id = "aliice-chat-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      /* ── Force the Retell widget to fill the entire viewport ── */
      retell-widget,
      #retell-widget-container,
      [id^="retell-widget"] {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        z-index: 100 !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }

      /* Hide the circular launcher button */
      retell-widget::part(button),
      [class*="retell"][class*="button"],
      [class*="retell"][class*="trigger"],
      [class*="retell"][class*="launcher"],
      [class*="widget-button"],
      [class*="chat-button"],
      [class*="fab"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* Force the modal/chat panel itself to be full-screen */
      [class*="retell"][class*="modal"],
      [class*="retell"][class*="panel"],
      [class*="retell"][class*="window"],
      [class*="retell"][class*="chat"],
      [class*="chat-modal"],
      [class*="chat-window"],
      [class*="chat-panel"] {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        margin: 0 !important;
        transform: none !important;
        bottom: 0 !important;
        right: 0 !important;
        top: 0 !important;
        left: 0 !important;
      }

      /* ── Make injected links clickable & styled ── */
      .aliice-auto-link {
        color: #0ea5e9 !important;
        text-decoration: underline !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        word-break: break-all !important;
      }
      .aliice-auto-link:hover {
        color: #0284c7 !important;
      }

      /* ── Typing indicator dots ── */
      @keyframes aliiceDot {
        0%,60%,100% { transform:translateY(0); opacity:.5; }
        30%          { transform:translateY(-6px); opacity:1; }
      }
      .aliice-typing-dot {
        display: inline-block;
        width: 7px; height: 7px;
        border-radius: 50%;
        background: #94a3b8;
        animation: aliiceDot 1.3s ease-in-out infinite;
        margin: 0 2px;
      }
      .aliice-typing-dot:nth-child(2) { animation-delay: 0.18s; }
      .aliice-typing-dot:nth-child(3) { animation-delay: 0.36s; }
      .aliice-typing-bubble {
        display: inline-flex;
        align-items: center;
        padding: 10px 14px;
        background: #f1f5f9;
        border-radius: 18px 18px 18px 4px;
        margin: 4px 0;
      }

      /* Welcome card animations */
      @keyframes slideUp {
        from { opacity:0; transform:translateY(32px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes fadeOut {
        to   { opacity:0; transform:translateY(16px); }
      }
      .aliice-card { animation: slideUp 0.38s cubic-bezier(0.34,1.56,0.64,1) both; }
      .aliice-card.out { animation: fadeOut 0.26s ease-in forwards; }
    `;
    document.head.appendChild(s);
  }, []);

  // MutationObserver: scan all bot message text nodes and linkify URLs + phone numbers
  useEffect(() => {
    // Regex patterns
    const urlRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"]+)/g;
    const phoneRe = /(\+\d[\d\s\-().]{6,20}\d)/g;

    function linkifyNode(el: Element) {
      // Only process text nodes inside this element
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) nodes.push(n as Text);

      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || parent.tagName === "A") continue;
        const raw = node.textContent || "";
        if (!urlRe.test(raw) && !phoneRe.test(raw)) continue;

        // Reset lastIndex
        urlRe.lastIndex = 0;
        phoneRe.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let last = 0;
        const combined = new RegExp(
          `\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)|(https?:\\/\\/[^\\s<>"]+)|(\\+\\d[\\d\\s\\-.()]{6,20}\\d)`,
          "g"
        );
        let m: RegExpExecArray | null;
        while ((m = combined.exec(raw)) !== null) {
          if (m.index > last) frag.appendChild(document.createTextNode(raw.slice(last, m.index)));

          const a = document.createElement("a");
          a.className = "aliice-auto-link";
          a.target = "_blank";
          a.rel = "noopener noreferrer";

          if (m[1] && m[2]) {
            // Markdown [text](url)
            a.href = m[2];
            a.textContent = m[1];
          } else if (m[3]) {
            // Raw URL
            a.href = m[3];
            a.textContent = m[3];
          } else if (m[4]) {
            // Phone number
            a.href = `tel:${m[4].replace(/[\s\-().]/g, "")}`;
            a.textContent = m[4];
          }
          frag.appendChild(a);
          last = m.index + m[0].length;
        }
        if (last < raw.length) frag.appendChild(document.createTextNode(raw.slice(last)));

        parent.replaceChild(frag, node);
      }
    }

    // Observe the whole document for new chat message nodes
    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of Array.from(mut.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            linkifyNode(node as Element);
            (node as Element).querySelectorAll("*").forEach(linkifyNode);
          }
        }
        // Also re-check changed text nodes
        if (mut.type === "characterData" && mut.target.parentElement) {
          linkifyNode(mut.target.parentElement);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  // After the widget script loads, click its button to open the chat
  const handleWidgetLoad = () => {
    if (!showWelcome) triggerOpen();
  };

  const triggerOpen = () => {
    let attempts = 0;
    const interval = setInterval(() => {
      // Try every possible selector the widget might use for its open button
      const btn = document.querySelector<HTMLElement>(
        [
          "retell-widget",            // custom element itself might be clickable
          "[class*='retell-btn']",
          "[class*='retell-trigger']",
          "[class*='retell-launcher']",
          "[class*='widget-btn']",
          "[class*='chat-btn']",
          "[class*='open-chat']",
          "retell-widget button",
          "#retell-widget-btn",
        ].join(", ")
      );
      if (btn) {
        btn.click();
        clearInterval(interval);
        return;
      }
      // Also try dispatching a custom event in case the widget listens
      window.dispatchEvent(new CustomEvent("retell:open"));
      document.dispatchEvent(new CustomEvent("retell:open"));
      attempts++;
      if (attempts > 60) clearInterval(interval); // give up after 6 seconds
    }, 100);
  };

  const handleStartChat = () => {
    const card = document.querySelector(".aliice-card");
    if (card) {
      card.classList.add("out");
      setDismissing(true);
      setTimeout(() => {
        setShowWelcome(false);
        triggerOpen();
      }, 260);
    } else {
      setShowWelcome(false);
      triggerOpen();
    }
  };

  return (
    <main className="fixed inset-0 bg-white overflow-hidden">

      {/* Retell widget script — always present so it initialises immediately */}
      <Script
        id="retell-widget"
        src="https://dashboard.retellai.com/retell-widget.js"
        strategy="afterInteractive"
        data-public-key={RETELL_PUBLIC_KEY}
        data-agent-id={RETELL_AGENT_ID}
        data-title="Aliice — Aesthetics Clinic"
        data-logo-url={AVATAR_URL}
        data-color="#0ea5e9"
        data-bot-name="Aliice"
        data-popup-message="Hi! All prices are in CHF. How can I help you?"
        data-show-ai-popup="false"
        data-auto-open="false"
        data-dynamic={JSON.stringify({
          currency: "CHF",
          clinic_phone: CLINIC_PHONE,
          clinic_phone_tel: CLINIC_PHONE_TEL,
          book_url: BOOK_URL,
          booking_link: BOOK_URL,
          instructions: `Always use CHF for prices. The clinic phone number is ${CLINIC_PHONE}. The booking link is ${BOOK_URL}. When sharing the phone number always write it exactly as ${CLINIC_PHONE}. When sharing the booking link always use this exact URL: ${BOOK_URL}`,
        })}
        onLoad={handleWidgetLoad}
      />

      {/* Welcome card — sits above the widget at higher z-index */}
      {showWelcome && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-5"
          style={{ background: "linear-gradient(160deg,#f8fafc 0%,#fff 55%,#f0f9ff 100%)" }}
        >
          <div className={`aliice-card w-full max-w-[340px] flex flex-col items-center${dismissing ? " out" : ""}`}>

            {/* Avatar */}
            <div className="relative mb-5">
              <div className="w-[112px] h-[112px] rounded-full overflow-hidden shadow-2xl"
                style={{ border: "4px solid #e0f2fe" }}>
                <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={112} height={112}
                  className="w-full h-full object-cover object-top" priority />
              </div>
              <span className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow" />
            </div>

            <h1 className="text-[1.65rem] font-semibold text-slate-800 mb-1 text-center tracking-tight">
              Hi, I&apos;m Aliice
            </h1>
            <p className="text-slate-500 text-sm text-center mb-7 leading-relaxed max-w-[260px]">
              Your AI assistant at{" "}
              <span className="font-semibold text-slate-700">Aesthetics Clinic Geneva</span>.
              <br />How can I help you today?
            </p>

            <div className="w-full space-y-3 mb-6">
              <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-[15px] px-6 rounded-2xl text-white font-medium text-[15px] transition-all active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)", boxShadow: "0 8px 24px rgba(14,165,233,.32)" }}>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book an Appointment
              </a>

              <a href={`tel:${CLINIC_PHONE_TEL}`}
                className="flex items-center justify-center gap-3 w-full py-[15px] px-6 rounded-2xl bg-white text-slate-700 font-medium text-[15px] border border-slate-200 shadow-sm transition-all active:scale-[0.97] hover:bg-slate-50">
                <svg className="w-5 h-5 shrink-0 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Us <span className="text-sky-600 font-semibold">{CLINIC_PHONE}</span>
              </a>

              <button onClick={handleStartChat}
                className="flex items-center justify-center gap-2.5 w-full py-[15px] px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-[15px] transition-all active:scale-[0.97] shadow-lg">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with Aliice
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center">
              All prices are in <strong className="text-slate-500">CHF</strong> (Swiss Francs)
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
