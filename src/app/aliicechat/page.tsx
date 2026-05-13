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
  const [welcomed, setWelcomed] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      /* Make the Retell chat widget full-screen on this page */
      #retell-widget-container {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9998 !important;
      }

      /* Hide the floating button — we trigger it programmatically */
      .retell-widget-button {
        opacity: 0 !important;
        pointer-events: none !important;
        position: fixed !important;
        bottom: -100px !important;
      }

      /* Make the chat modal full-screen */
      .retell-chat-modal,
      .retell-widget-modal {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        margin: 0 !important;
      }

      /* Typing indicator animation - bouncing dots */
      @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-8px); }
      }

      /* Style the typing/loading indicator in Retell widget */
      [class*="typing"],
      [class*="loading"],
      [class*="thinking"],
      [class*="Typing"],
      [class*="Loading"],
      [class*="Thinking"] {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 12px 16px !important;
        background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
        border-radius: 18px !important;
        margin: 8px 0 !important;
      }

      .retell-typing-indicator,
      [class*="typing-indicator"] {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
      }

      .retell-typing-indicator span,
      [class*="typing-indicator"] span {
        width: 8px !important;
        height: 8px !important;
        background: #0ea5e9 !important;
        border-radius: 50% !important;
        animation: typingBounce 1.4s ease-in-out infinite !important;
      }

      .retell-typing-indicator span:nth-child(1),
      [class*="typing-indicator"] span:nth-child(1) { animation-delay: 0s !important; }
      .retell-typing-indicator span:nth-child(2),
      [class*="typing-indicator"] span:nth-child(2) { animation-delay: 0.2s !important; }
      .retell-typing-indicator span:nth-child(3),
      [class*="typing-indicator"] span:nth-child(3) { animation-delay: 0.4s !important; }

      @keyframes messageAppear {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      [class*="message"] { animation: messageAppear 0.3s ease-out !important; }

      /* Slide-up animation for welcome card */
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .aliice-welcome-card { animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }

      /* Fade-out when dismissing */
      @keyframes fadeOut {
        to { opacity: 0; transform: translateY(20px); }
      }
      .aliice-welcome-card.dismissing { animation: fadeOut 0.25s ease-in forwards; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const handleStartChat = () => {
    const card = document.querySelector(".aliice-welcome-card");
    const dismiss = () => {
      setWelcomed(true);
      // Trigger the widget to open by clicking its hidden button if it exists,
      // or dispatch a custom event the widget may listen to
      setTimeout(() => {
        const btn = document.querySelector<HTMLElement>(
          ".retell-widget-button, [class*='widget-button'], [class*='chat-button'], [id*='retell'] button"
        );
        if (btn) btn.click();
      }, 50);
    };
    if (card) {
      card.classList.add("dismissing");
      setTimeout(dismiss, 230);
    } else {
      dismiss();
    }
  };

  // Once welcomed, open the widget
  useEffect(() => {
    if (!welcomed) return;
    const tryOpen = () => {
      const btn = document.querySelector<HTMLElement>(
        ".retell-widget-button, [class*='widget-button'], [class*='chat-button'], [id*='retell'] button"
      );
      if (btn) { btn.click(); return true; }
      return false;
    };
    if (!tryOpen()) {
      const interval = setInterval(() => { if (tryOpen()) clearInterval(interval); }, 100);
      setTimeout(() => clearInterval(interval), 5000);
    }
  }, [welcomed]);

  return (
    <main className="min-h-screen bg-white flex flex-col">

      {/* Retell widget always loads so it's ready in the background */}
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
        data-popup-message="Hi! I'm Aliice. All prices are in CHF. How can I help you?"
        data-show-ai-popup="false"
        data-auto-open={welcomed ? "true" : "false"}
        data-dynamic={JSON.stringify({ currency: "CHF", clinic_phone: CLINIC_PHONE, book_url: BOOK_URL })}
        onLoad={() => setWidgetReady(true)}
      />

      {/* Welcome card — overlaid ON TOP of the chat widget, z-index above it */}
      {!welcomed && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
          style={{ background: "linear-gradient(160deg, #f8fafc 0%, #ffffff 50%, #f0f9ff 100%)" }}
        >
          <div className="aliice-welcome-card w-full max-w-[340px] flex flex-col items-center">

            {/* Avatar */}
            <div className="relative mb-5">
              <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-sky-100 shadow-2xl">
                <Image
                  src="/logos/AliiceAgent.jpg"
                  alt="Aliice"
                  width={112}
                  height={112}
                  className="w-full h-full object-cover object-top"
                  priority
                />
              </div>
              <span className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-md" />
            </div>

            {/* Greeting */}
            <h1 className="text-[1.6rem] font-semibold text-slate-800 mb-1 text-center tracking-tight">
              Hi, I&apos;m Aliice
            </h1>
            <p className="text-slate-500 text-sm text-center mb-7 leading-relaxed max-w-[260px]">
              Your AI assistant at{" "}
              <span className="font-semibold text-slate-700">Aesthetics Clinic Geneva</span>.
              <br />How can I help you today?
            </p>

            {/* Action buttons */}
            <div className="w-full space-y-3 mb-6">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-[15px] px-6 rounded-2xl text-white font-medium text-[15px] transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)", boxShadow: "0 8px 24px rgba(14,165,233,0.35)" }}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book an Appointment
              </a>

              <a
                href={`tel:${CLINIC_PHONE_TEL}`}
                className="flex items-center justify-center gap-3 w-full py-[15px] px-6 rounded-2xl bg-white text-slate-700 font-medium text-[15px] border border-slate-200 shadow-sm transition-all active:scale-95 hover:bg-slate-50"
              >
                <svg className="w-5 h-5 flex-shrink-0 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Us
                <span className="text-sky-600 font-semibold">{CLINIC_PHONE}</span>
              </a>

              <button
                onClick={handleStartChat}
                className="flex items-center justify-center gap-2.5 w-full py-[15px] px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-[15px] transition-all active:scale-95 shadow-lg"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with Aliice
                {!widgetReady && (
                  <svg className="animate-spin h-4 w-4 ml-1 opacity-60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                )}
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
