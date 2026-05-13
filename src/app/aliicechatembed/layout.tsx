import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Embed Aliice Chat Widget | Developer Documentation",
  description: "Documentation and embed codes for integrating the Aliice chat widget on your website",
};

export default function AliiceChatEmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout bypasses the main app layout's sidebar/header/auth
  // by rendering children directly without the shell components
  return <>{children}</>;
}
