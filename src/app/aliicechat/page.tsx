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

  useEffect(() => {
    // Add custom styles
    const style = document.createElement("style");
    style.innerHTML = `
      /* Make the Retell chat widget full-screen on this page */
      #retell-widget-container {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9999 !important;
      }
      
      /* Hide the floating button since we auto-open */
      .retell-widget-button {
        display: none !important;
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
      
      @keyframes typingPulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
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
      
      /* Create custom typing dots via pseudo-elements if needed */
      .retell-typing-indicator,
      [class*="typing-indicator"] {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
      }
      
      .retell-typing-indicator::before,
      .retell-typing-indicator span,
      [class*="typing-indicator"] span {
        content: '';
        width: 8px !important;
        height: 8px !important;
        background: #0ea5e9 !important;
        border-radius: 50% !important;
        animation: typingBounce 1.4s ease-in-out infinite !important;
      }
      
      .retell-typing-indicator span:nth-child(1),
      [class*="typing-indicator"] span:nth-child(1) {
        animation-delay: 0s !important;
      }
      
      .retell-typing-indicator span:nth-child(2),
      [class*="typing-indicator"] span:nth-child(2) {
        animation-delay: 0.2s !important;
      }
      
      .retell-typing-indicator span:nth-child(3),
      [class*="typing-indicator"] span:nth-child(3) {
        animation-delay: 0.4s !important;
      }
      
      /* Smooth message appearance */
      [class*="message"] {
        animation: messageAppear 0.3s ease-out !important;
      }
      
      @keyframes messageAppear {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">

      {/* Welcome screen shown before chat opens */}
      {!welcomed && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-6">
          <div className="w-full max-w-sm flex flex-col items-center">
            {/* Avatar */}
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-sky-200 shadow-xl">
                <Image
                  src="/logos/AliiceAgent.jpg"
                  alt="Aliice Agent"
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow" />
            </div>

            {/* Greeting */}
            <h1 className="text-2xl font-semibold text-slate-800 mb-1 text-center">Hi, I&apos;m Aliice</h1>
            <p className="text-slate-500 text-sm text-center mb-8 leading-relaxed">
              Your AI assistant at <span className="font-medium text-slate-700">Aesthetics Clinic Geneva</span>.<br />
              How can I help you today?
            </p>

            {/* Quick Action Buttons */}
            <div className="w-full space-y-3 mb-8">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-medium text-base shadow-lg shadow-sky-200 transition-all"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book an Appointment
              </a>

              <a
                href={`tel:${CLINIC_PHONE_TEL}`}
                className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium text-base border border-slate-200 shadow-sm transition-all"
              >
                <svg className="w-5 h-5 flex-shrink-0 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Us &nbsp;<span className="text-sky-600 font-semibold">{CLINIC_PHONE}</span>
              </a>
            </div>

            {/* Chat CTA */}
            <button
              onClick={() => setWelcomed(true)}
              className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-base transition-all"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat with Aliice
            </button>

            <p className="mt-5 text-xs text-slate-400 text-center">All prices are in <strong>CHF</strong> (Swiss Francs)</p>
          </div>
        </div>
      )}

      {/* Background content (chat loads here once welcomed) */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 text-slate-600">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Loading Aliice Chat...</span>
          </div>
        </div>
      </div>

      {/* Retell AI Chat Widget Script — loads in background, auto-opens only after welcome */}
      {welcomed && (
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
          data-show-ai-popup="true"
          data-show-ai-popup-time="1"
          data-auto-open="true"
          data-dynamic={JSON.stringify({ currency: "CHF", clinic_phone: CLINIC_PHONE, book_url: BOOK_URL })}
        />
      )}
    </main>
  );
}
