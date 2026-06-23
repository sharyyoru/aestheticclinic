import type { Metadata } from "next";
import { GoogleTagManager, GoogleTagManagerNoScript } from "@/components/GoogleTagManager";
import EmbedBackground from "@/components/EmbedBackground";

export const metadata: Metadata = {
  title: "Contact Us | Aesthetics Clinic",
  description: "Get in touch with Aesthetics Clinic Geneva",
};

export default function EmbedContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <EmbedBackground />
      <GoogleTagManager />
      <GoogleTagManagerNoScript />
      {children}
    </>
  );
}
