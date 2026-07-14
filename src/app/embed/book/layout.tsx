import type { Metadata } from "next";
import { GoogleTagManager, GoogleTagManagerNoScript } from "@/components/GoogleTagManager";
import EmbedBackground from "@/components/EmbedBackground";
import ForceLightMode from "@/components/ForceLightMode";

export const metadata: Metadata = {
  title: "Book Appointment | Aesthetics Clinic",
  description: "Book your appointment at Aesthetics Clinic Geneva",
};

export default function EmbedBookLayout({
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
