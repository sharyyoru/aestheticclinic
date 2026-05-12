"use client";

import { useEffect } from "react";
import Image from "next/image";
import Script from "next/script";

// Retell AI Configuration
const RETELL_PUBLIC_KEY = "key_19ba0b68c96753283f143e6dc1d8";
const RETELL_AGENT_ID = "agent_49322ed02ae4ea55665d81536c";

export default function AliiceChatPage() {
  useEffect(() => {
    // Add custom styles to make the chat widget full-screen and add typing animation
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
      {/* Loading state while widget loads */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <Image
            src="/logos/aliice-logo.png"
            alt="Aliice"
            width={180}
            height={48}
            className="h-12 w-auto mx-auto mb-6"
            priority
          />
          <div className="flex items-center justify-center gap-3 text-slate-600">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Loading Aliice Chat...</span>
          </div>
        </div>
      </div>

      {/* Retell AI Chat Widget Script */}
      <Script
        id="retell-widget"
        src="https://dashboard.retellai.com/retell-widget.js"
        strategy="afterInteractive"
        data-public-key={RETELL_PUBLIC_KEY}
        data-agent-id={RETELL_AGENT_ID}
        data-title="Chat with Aliice"
        data-logo-url="https://aestheticclinic.vercel.app/logos/aliice-logo.png"
        data-color="#0ea5e9"
        data-bot-name="Aliice"
        data-popup-message="Hi! I'm Aliice, your AI assistant. How can I help you today?"
        data-show-ai-popup="true"
        data-show-ai-popup-time="1"
        data-auto-open="true"
      />
    </main>
  );
}
