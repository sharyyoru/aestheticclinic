import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface CertificatePageProps {
  params: Promise<{ id: string }>;
}

async function getCertificate(id: string) {
  const { data: certificate } = await supabaseAdmin
    .from("academy_certificates")
    .select(`
      id,
      certificate_number,
      completed_at,
      user_id,
      module_id,
      users:user_id (
        first_name,
        last_name,
        email
      ),
      academy_modules:module_id (
        title,
        description
      )
    `)
    .eq("id", id)
    .single();

  return certificate;
}

export default async function CertificatePage({ params }: CertificatePageProps) {
  const { id } = await params;
  const certificate = await getCertificate(id);

  if (!certificate) {
    notFound();
  }

  const user = certificate.users as any;
  const module = certificate.academy_modules as any;
  const completedDate = new Date(certificate.completed_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Print Button */}
        <div className="mb-4 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Certificate
          </button>
        </div>

        {/* Certificate */}
        <div className="relative overflow-hidden rounded-2xl border-4 border-indigo-200 bg-white p-12 shadow-2xl print:shadow-none print:border-2">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="1" fill="currentColor" />
              </pattern>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>

          {/* Corner Decorations */}
          <div className="absolute left-0 top-0 h-24 w-24 border-l-4 border-t-4 border-indigo-300" />
          <div className="absolute right-0 top-0 h-24 w-24 border-r-4 border-t-4 border-indigo-300" />
          <div className="absolute bottom-0 left-0 h-24 w-24 border-b-4 border-l-4 border-indigo-300" />
          <div className="absolute bottom-0 right-0 h-24 w-24 border-b-4 border-r-4 border-indigo-300" />

          <div className="relative text-center">
            {/* Logo */}
            <div className="mb-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Aliice Academy
            </h1>
            <h2 className="mt-2 text-4xl font-bold text-slate-900">
              Certificate of Completion
            </h2>

            {/* Recipient */}
            <div className="mt-8">
              <p className="text-sm text-slate-500">This is to certify that</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {user?.first_name} {user?.last_name}
              </p>
            </div>

            {/* Achievement */}
            <div className="mt-8">
              <p className="text-sm text-slate-500">has successfully completed the</p>
              <p className="mt-2 text-2xl font-semibold text-indigo-600">
                {module?.title}
              </p>
              <p className="mt-1 text-sm text-slate-500">training module</p>
            </div>

            {/* Date */}
            <div className="mt-8">
              <p className="text-sm text-slate-500">Completed on</p>
              <p className="mt-1 text-lg font-medium text-slate-700">{completedDate}</p>
            </div>

            {/* Certificate Number */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-400">
                Certificate ID: {certificate.certificate_number}
              </p>
            </div>

            {/* Signature */}
            <div className="mt-8 flex justify-center gap-16">
              <div className="text-center">
                <div className="h-px w-32 bg-slate-300" />
                <p className="mt-2 text-xs text-slate-500">Aliice Academy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-4 text-center print:hidden">
          <Link
            href="/academy"
            className="text-sm text-slate-600 hover:text-indigo-600"
          >
            ← Back to Academy
          </Link>
        </div>
      </div>
    </div>
  );
}
