import type { Metadata, Viewport } from "next";
import "../prodapp.css";

export const metadata: Metadata = {
  title: "Sign In - Aliice CRM",
  description: "Sign in to your clinic account",
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
  themeColor: "#f8fafc",
};

export default function ProdAppLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
