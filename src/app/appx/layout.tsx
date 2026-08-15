import type { Metadata, Viewport } from "next";
import ForceLightMode from "@/components/ForceLightMode";

export const metadata: Metadata = {
  title: "Aliice Assistant | Aesthetics Clinic",
  description: "AI-powered mobile assistant for patient management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function AppxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ForceLightMode />
      {children}
    </>
  );
}
