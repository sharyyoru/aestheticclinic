import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * New statistic: Patients who appeared in a given agenda (location) 
 * and how much they paid during a certain time period.
 * 
 * Example: Patients in agenda "Montreux" who paid from January to June 2026
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const location = url.searchParams.get("location"); // Agenda location filter
    
    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to' date parameters" }, { status: 400 });
    }

    // Step 1: Find all unique patients who had appointments in the specified location
    // We need to look at all historical appointments, not just in the date range
    let locationQuery = supabaseAdmin
      .from("appointments")
      .select("patient_id")
      .not("patient_id", "is", null);
    
    if (location) {
      locationQuery = locationQuery.eq("location", location);
    }
    
    const { data: locationPatients, error: locationError } = await locationQuery;
    
    if (locationError) throw new Error(locationError.message);
    
    // Get unique patient IDs from the location
    const patientIds = [...new Set(locationPatients?.map(p => p.patient_id) || [])];
    
    if (patientIds.length === 0) {
      return NextResponse.json({
        rows: [],
        totals: { 
          patientCount: 0, 
          invoiceCount: 0, 
          totalPaid: 0, 
          totalBilled: 0 
        },
        groups: {
          byMonth: [],
          byPaymentMethod: [],
          byPatient: []
        }
      });
    }
    
    // Step 2: Find all invoices for these patients that were paid in the specified date range
    const { data: invoices, error: invoiceError } = await supabaseAdmin
      .from("v_invoices_enriched")
      .select(`
        invoice_id,
        invoice_number,
        invoice_date,
        paid_at,
        paid_date_effective,
        payment_method,
        invoice_title,
        amount_excl_vat,
        total_amount,
        paid_amount,
        status,
        billing_type,
        health_insurance_law,
        provider_id,
        provider_name,
        doctor_user_id,
        doctor_name,
        patient_id,
        patient_first_name,
        patient_last_name,
        vat_free_amount,
        vat_reduced_amount,
        vat_full_amount,
        patients!inner(
          email,
          phone
        )
      `)
      .in("patient_id", patientIds)
      .eq("is_demo", false)
      .eq("is_archived", false)
      .gte("paid_date_effective", `${from}T00:00:00Z`)
      .lte("paid_date_effective", `${to}T23:59:59Z`)
      .in("status", ["PAID", "PARTIAL_PAID", "OVERPAID"])
      .order("paid_date_effective", { ascending: false });
    
    if (invoiceError) throw new Error(invoiceError.message);
    
    // Step 3: Also check invoice_payments table for more detailed payment data
    const { data: payments, error: paymentError } = await supabaseAdmin
      .from("invoice_payments")
      .select(`
        *,
        invoices!inner(
          patient_id,
          invoice_number,
          invoice_date,
          total_amount,
          paid_amount,
          payment_method,
          status,
          patients!inner(
            first_name,
            last_name,
            email,
            phone
          )
        )
      `)
      .in("invoices.patient_id", patientIds)
      .gte("payment_date", from)
      .lte("payment_date", to)
      .order("payment_date", { ascending: false });
    
    if (paymentError) throw new Error(paymentError.message);
    
    // Step 4: Process and group the data - use both invoice_payments and invoices data
    const allPayments = payments || [];
    
    // Process payment data - use invoice_payments if available, otherwise fall back to invoices
    const paymentData = allPayments.length > 0 ? allPayments.map(payment => ({
      id: payment.id,
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      notes: payment.notes,
      invoices: {
        patient_id: payment.invoices.patient_id,
        invoice_number: payment.invoices.invoice_number,
        invoice_date: payment.invoices.invoice_date,
        total_amount: payment.invoices.total_amount,
        paid_amount: payment.invoices.paid_amount,
        payment_method: payment.invoices.payment_method,
        status: payment.invoices.status,
        patient_first_name: payment.invoices.patients?.first_name,
        patient_last_name: payment.invoices.patients?.last_name,
        patient_email: payment.invoices.patients?.email,
        patient_phone: payment.invoices.patients?.phone
      }
    })) : (invoices || []).map(inv => ({
      id: inv.invoice_id,
      invoice_id: inv.invoice_id,
      amount: inv.paid_amount,
      payment_date: inv.paid_date_effective?.split('T')[0] || inv.paid_at?.split('T')[0],
      payment_method: inv.payment_method,
      notes: null,
      invoices: {
        patient_id: inv.patient_id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        total_amount: inv.total_amount,
        paid_amount: inv.paid_amount,
        payment_method: inv.payment_method,
        status: inv.status,
        patient_first_name: inv.patient_first_name || inv.patients?.first_name,
        patient_last_name: inv.patient_last_name || inv.patients?.last_name,
        patient_email: inv.patients?.email,
        patient_phone: inv.patients?.phone
      }
    }));
    
    // Group by month
    const byMonth: Record<string, { 
      key: string; 
      label: string; 
      patientCount: number; 
      invoiceCount: number; 
      totalPaid: number; 
      totalBilled: number; 
    }> = {};
    
    // Group by payment method
    const byPaymentMethod: Record<string, { 
      key: string; 
      label: string; 
      patientCount: number; 
      invoiceCount: number; 
      totalPaid: number; 
      totalBilled: number; 
    }> = {};
    
    // Group by patient (top patients)
    const byPatient: Record<string, { 
      key: string; 
      label: string; 
      invoiceCount: number; 
      totalPaid: number; 
      totalBilled: number; 
      email?: string; 
      phone?: string; 
    }> = {};
    
    let totalPaid = 0;
    let totalBilled = 0;
    const uniquePatients = new Set<string>();
    const uniqueInvoices = new Set<string>();
    
    paymentData.forEach(payment => {
      const invoice = payment.invoices;
      if (!invoice) return;
      
      const month = payment.payment_date?.slice(0, 7) || 'Unknown'; // YYYY-MM
      const method = payment.payment_method || 'Unknown';
      const patientKey = invoice.patient_id;
      const patientLabel = `${invoice.patient_last_name || ''} ${invoice.patient_first_name || ''}`.trim() || 'Unknown';
      
      // Update totals
      totalPaid += payment.amount || 0;
      totalBilled += invoice.total_amount || 0;
      uniquePatients.add(patientKey);
      uniqueInvoices.add(invoice.invoice_number);
      
      // Group by month
      if (!byMonth[month]) {
        byMonth[month] = { key: month, label: month, patientCount: 0, invoiceCount: 0, totalPaid: 0, totalBilled: 0 };
      }
      byMonth[month].invoiceCount++;
      byMonth[month].totalPaid += payment.amount || 0;
      byMonth[month].totalBilled += invoice.total_amount || 0;
      
      // Group by payment method
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = { key: method, label: method, patientCount: 0, invoiceCount: 0, totalPaid: 0, totalBilled: 0 };
      }
      byPaymentMethod[method].invoiceCount++;
      byPaymentMethod[method].totalPaid += payment.amount || 0;
      byPaymentMethod[method].totalBilled += invoice.total_amount || 0;
      
      // Group by patient
      if (!byPatient[patientKey]) {
        byPatient[patientKey] = { 
          key: patientKey, 
          label: patientLabel, 
          invoiceCount: 0, 
          totalPaid: 0, 
          totalBilled: 0,
          email: invoice.patient_email || undefined,
          phone: invoice.patient_phone || undefined
        };
      }
      byPatient[patientKey].invoiceCount++;
      byPatient[patientKey].totalPaid += payment.amount || 0;
      byPatient[patientKey].totalBilled += invoice.total_amount || 0;
    });
    
    // Update patient counts for payment methods
    Object.values(byPaymentMethod).forEach(method => {
      const methodPatients = new Set<string>();
      paymentData.forEach(payment => {
        if (payment.payment_method === method.key) {
          methodPatients.add(payment.invoices.patient_id);
        }
      });
      method.patientCount = methodPatients.size;
    });
    
    // Update patient counts for months
    Object.values(byMonth).forEach(month => {
      const monthPatients = new Set<string>();
      paymentData.forEach(payment => {
        if (payment.payment_date?.slice(0, 7) === month.key) {
          monthPatients.add(payment.invoices.patient_id);
        }
      });
      month.patientCount = monthPatients.size;
    });
    
    // Prepare response rows
    const rows = paymentData.map(payment => ({
      payment_id: payment.id,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      amount: payment.amount,
      invoice_number: payment.invoices.invoice_number,
      invoice_date: payment.invoices.invoice_date,
      invoice_total: payment.invoices.total_amount,
      invoice_paid: payment.invoices.paid_amount,
      invoice_status: payment.invoices.status,
      patient_id: payment.invoices.patient_id,
      patient_first_name: payment.invoices.patient_first_name,
      patient_last_name: payment.invoices.patient_last_name,
      patient_email: payment.invoices.patient_email,
      patient_phone: payment.invoices.patient_phone,
      notes: payment.notes
    }));
    
    return NextResponse.json({
      rows,
      totals: {
        patientCount: uniquePatients.size,
        invoiceCount: uniqueInvoices.size,
        totalPaid,
        totalBilled
      },
      groups: {
        byMonth: Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key)),
        byPaymentMethod: Object.values(byPaymentMethod).sort((a, b) => b.totalPaid - a.totalPaid),
        byPatient: Object.values(byPatient).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 20) // Top 20 patients
      }
    });
    
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}