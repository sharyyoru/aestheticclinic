import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Aliice Assistant | Aesthetics Clinic",
  description: "AI-powered mobile assistant for patient management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AppxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
