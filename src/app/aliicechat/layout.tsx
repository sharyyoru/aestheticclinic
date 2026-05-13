import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat with Aliice | Aesthetics Clinic",
  description: "Chat with Aliice, your AI assistant at Aesthetics Clinic Geneva",
};

export default function AliiceChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout bypasses the main app layout's sidebar/header/auth
  // by rendering children directly without the shell components
  return <>{children}</>;
}
