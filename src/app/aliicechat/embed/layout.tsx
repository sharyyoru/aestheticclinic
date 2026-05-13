import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aliice Chat Widget",
  description: "Chat with Aliice, your AI assistant at Aesthetics Clinic Geneva",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Standalone embed - no sidebar, header, or auth required
  return <>{children}</>;
}
