"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type InvoiceData = {
  id: string;
  consultation_id: string;
  title: string;
  scheduled_at: string;
  invoice_total_amount: number | null;
  payment_method: string | null;
  doctor_name: string | null;
  invoice_is_paid: boolean;
  pdf_url: string | null;
  payrexx_payment_link: string | null;
};

type PatientData = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
};

export default function InvoicePaymentPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "bank" | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid payment link");
      setLoading(false);
      return;
    }

    async function loadInvoice() {
      try {
        const response = await fetch(`/api/invoices/public/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Invoice not found or link has expired");
          setLoading(false);
          return;
        }

        setInvoice(data.invoice);
        setPatient(data.patient);
        setLoading(false);
      } catch (err) {
        console.error("Error loading invoice:", err);
        setError("Failed to load invoice");
        setLoading(false);
      }
    }

    void loadInvoice();
  }, [token]);

  async function handleStripePayment() {
    if (!invoice) return;

    setProcessingPayment(true);
    try {
      const response = await fetch("/api/payments/create-stripe-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId: invoice.id,
          amount: invoice.invoice_total_amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Error processing payment:", err);
      alert("Failed to process payment. Please try again.");
      setProcessingPayment(false);
    }
  }

  function handleBankTransfer() {
    setPaymentMethod("bank");
  }

  function downloadPDF() {
    if (!invoice?.pdf_url) return;
    window.open(invoice.pdf_url, "_blank");
  }

  function handlePayrexxPayment() {
    if (invoice?.payrexx_payment_link) {
      window.location.href = invoice.payrexx_payment_link;
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600"></div>
          <p className="text-sm text-slate-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice || !patient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Payment Link Error</h1>
          <p className="text-sm text-slate-600">{error || "Unable to load invoice"}</p>
        </div>
      </div>
    );
  }

  if (invoice.invoice_is_paid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Already Paid</h1>
          <p className="mb-6 text-sm text-slate-600">This invoice has already been paid.</p>
          {invoice.pdf_url && (
            <button
              onClick={downloadPDF}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Invoice
            </button>
          )}
        </div>
      </div>
    );
  }

  // If this is an Online Payment invoice with Payrexx link, redirect to Payrexx
  const hasPayrexxPayment = invoice.payment_method === "Online Payment" && invoice.payrexx_payment_link;

  const totalAmount = invoice.invoice_total_amount || 0;
  const formattedAmount = totalAmount.toFixed(2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Invoice Payment</h1>
          <p className="text-sm text-slate-600">Aesthetics Clinic XT SA</p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Invoice Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Invoice Number:</span>
                <span className="font-medium text-slate-900">{invoice.consultation_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Patient:</span>
                <span className="font-medium text-slate-900">
                  {patient.first_name} {patient.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Date:</span>
                <span className="font-medium text-slate-900">
                  {new Date(invoice.scheduled_at).toLocaleDateString("fr-CH")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Service:</span>
                <span className="font-medium text-slate-900">{invoice.title}</span>
              </div>
              {invoice.doctor_name && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Doctor:</span>
                  <span className="font-medium text-slate-900">{invoice.doctor_name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-900">Total Amount:</span>
              <span className="text-2xl font-bold text-slate-900">{formattedAmount} CHF</span>
            </div>
          </div>

          {invoice.pdf_url && (
            <button
              onClick={downloadPDF}
              className="mb-6 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Invoice PDF
              </div>
            </button>
          )}

          {hasPayrexxPayment ? (
            <div>
              <h3 className="mb-4 text-center text-sm font-semibold text-slate-900">Pay Online</h3>
              <button
                onClick={handlePayrexxPayment}
                className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 px-6 py-4 font-semibold text-white shadow-lg hover:from-sky-700 hover:to-sky-800"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Pay Now with Card
                </span>
              </button>
            </div>
          ) : !paymentMethod ? (
            <div>
              <h3 className="mb-4 text-center text-sm font-semibold text-slate-900">Choose Payment Method</h3>
              <div className="space-y-3">
                <button
                  onClick={handleStripePayment}
                  disabled={processingPayment}
                  className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 px-6 py-4 font-semibold text-white shadow-lg hover:from-sky-700 hover:to-sky-800 disabled:opacity-50"
                >
                  {processingPayment ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay Online with Card (Stripe)
                    </span>
                  )}
                </button>

                <button
                  onClick={handleBankTransfer}
                  className="w-full rounded-lg border-2 border-slate-300 bg-white px-6 py-4 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    Pay by Bank Transfer
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Bank Transfer Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="block text-xs font-medium text-slate-600">Account Holder:</span>
                  <span className="block font-mono text-slate-900">Aesthetics Clinic XT SA</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-600">IBAN:</span>
                  <span className="block font-mono text-slate-900">CH09 3078 8000 0502 4628 9</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-600">Bank:</span>
                  <span className="block font-mono text-slate-900">PostFinance</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-600">Reference Number:</span>
                  <span className="block font-mono text-slate-900">00 00000 00000 00000 05870 40016</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-600">Amount:</span>
                  <span className="block text-lg font-bold text-slate-900">{formattedAmount} CHF</span>
                </div>
              </div>
              <div className="mt-6 rounded-lg bg-amber-50 p-4">
                <p className="text-xs text-amber-800">
                  <strong>Important:</strong> Please include the reference number in your bank transfer to ensure proper processing of your payment.
                </p>
              </div>
              <button
                onClick={() => setPaymentMethod(null)}
                className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Choose Different Payment Method
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-500">
          <p>For questions about this invoice, please contact us at:</p>
          <p className="mt-1 font-medium">Tél. 022 732 22 23</p>
        </div>
      </div>
    </div>
  );
}
