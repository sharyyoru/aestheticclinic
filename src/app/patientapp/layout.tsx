import type { Metadata, Viewport } from "next";
import "../prodapp/prodapp.css";

export const metadata: Metadata = {
  title: "Aliice - Patient Portal",
  description: "Access your appointments, records and prescriptions",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aliice Patient",
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

export default function PatientAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
