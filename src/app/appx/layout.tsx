import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aliice Assistant | Aesthetics Clinic",
  description: "AI-powered mobile assistant for patient management",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function AppxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
