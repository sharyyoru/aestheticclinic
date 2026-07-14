import type { Metadata } from "next";
import ForceLightMode from "@/components/ForceLightMode";

export const metadata: Metadata = {
  title: "Patient Form - Aesthetics Clinic",
  description: "Complete your patient form",
};

export default function FormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ForceLightMode />
      {children}
    </div>
  );
}
