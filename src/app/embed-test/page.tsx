"use client";

import { useEffect } from "react";

export default function EmbedTestPage() {
  useEffect(() => {
    const iframe = document.createElement("iframe");
    iframe.src = "/aliicechat/embed?lang=en";
    iframe.id = "aliice-chat-frame";
    iframe.allow = "microphone";
    iframe.style.cssText = "position:fixed;bottom:0;right:0;border:none;z-index:9999;width:300px;height:130px;transition:width 0.3s ease,height 0.3s ease;";
    document.body.appendChild(iframe);

    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === "aliice-chat") {
        if (e.data.open) {
          iframe.style.width = "400px";
          iframe.style.height = "620px";
        } else {
          iframe.style.width = "300px";
          iframe.style.height = "130px";
        }
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      iframe.remove();
    };
  }, []);

  return (
    <div style={{ minHeight: "200vh", background: "#ffffff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px" }}>
        <div style={{ background: "#f1f5f9", borderRadius: 8, padding: 32, marginBottom: 40 }}>
          <div style={{ width: 200, height: 30, background: "#cbd5e1", borderRadius: 4, marginBottom: 20 }} />
          <div style={{ width: "100%", height: 16, background: "#e2e8f0", borderRadius: 4, marginBottom: 10 }} />
          <div style={{ width: "80%", height: 16, background: "#e2e8f0", borderRadius: 4, marginBottom: 10 }} />
          <div style={{ width: "90%", height: 16, background: "#e2e8f0", borderRadius: 4 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 40 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
              <div style={{ width: 60, height: 60, background: "#e2e8f0", borderRadius: "50%", marginBottom: 16 }} />
              <div style={{ width: "70%", height: 14, background: "#e2e8f0", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: "100%", height: 12, background: "#f1f5f9", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ width: "85%", height: 12, background: "#f1f5f9", borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 40 }}>
          <div style={{ width: 150, height: 20, background: "#cbd5e1", borderRadius: 4, marginBottom: 16 }} />
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ width: "100%", height: 14, background: "#f1f5f9", borderRadius: 4, marginBottom: 10 }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 180, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }} />
          ))}
        </div>
        <div style={{ marginBottom: 40 }}>
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{ width: "100%", height: 14, background: "#f1f5f9", borderRadius: 4, marginBottom: 10 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
