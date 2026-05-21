import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Aliice - Clinic CRM",
  description: "Medical CRM and ERP for aesthetic clinics",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aliice",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function ProdAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style jsx global>{`
        /* Disable text selection for native feel */
        body {
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
          overscroll-behavior: none;
        }
        
        /* Allow text selection in inputs */
        input, textarea {
          -webkit-user-select: text;
          user-select: text;
        }
        
        /* iOS safe areas */
        .safe-area-top {
          padding-top: env(safe-area-inset-top);
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        
        /* Smooth scrolling */
        .overscroll-contain {
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        
        /* Hide scrollbars for native feel */
        ::-webkit-scrollbar {
          display: none;
        }
        
        /* Active states for touch */
        button:active, a:active {
          opacity: 0.7;
        }
      `}</style>
      {children}
    </>
  );
}
