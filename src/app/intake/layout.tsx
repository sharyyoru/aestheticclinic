import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Patient Intake Form | Aesthetics Clinic",
  description: "Complete your patient intake form for Aesthetics Clinic Geneva",
};

export default function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout bypasses the main app layout's sidebar/header
  // by rendering children directly without the shell components
  return <>{children}</>;
}
