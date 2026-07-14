import type { Metadata } from "next";
import { GoogleTagManager, GoogleTagManagerNoScript } from "@/components/GoogleTagManager";
import EmbedBackground from "@/components/EmbedBackground";
import ForceLightMode from "@/components/ForceLightMode";

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
      <ForceLightMode />
      <EmbedBackground />
      <GoogleTagManager />
      <GoogleTagManagerNoScript />
      {children}
    </>
  );
}
