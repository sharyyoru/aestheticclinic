import type { Metadata, Viewport } from "next";
import "./prodapp.css";

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
  return <>{children}</>;
}
