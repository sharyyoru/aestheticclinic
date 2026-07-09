import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const location = url.searchParams.get("location");
    
    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to' date parameters" }, { status: 400 });
    }

    // Fetch the same data as the main route
    const apiUrl = new URL(`${req.url.replace('/export', '')}`);
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    
    // Summary worksheet
    const summaryData = [
      ['Agenda Patients Payments Summary'],
      [],
      ['Location', location || 'All Locations'],
      ['Period', `${from} to ${to}`],
      [],
      ['Total Patients', data.totals.patientCount],
      ['Total Invoices', data.totals.invoiceCount],
      ['Total Billed (CHF)', data.totals.totalBilled.toFixed(2)],
      ['Total Paid (CHF)', data.totals.totalPaid.toFixed(2)],
      [],
      ['By Month'],
      ['Month', 'Patients', 'Invoices', 'Billed (CHF)', 'Paid (CHF)'],
      ...data.groups.byMonth.map(m => [
        m.label,
        m.patientCount,
        m.invoiceCount,
        m.totalBilled.toFixed(2),
        m.totalPaid.toFixed(2)
      ]),
      [],
      ['By Payment Method'],
      ['Payment Method', 'Patients', 'Invoices', 'Billed (CHF)', 'Paid (CHF)'],
      ...data.groups.byPaymentMethod.map(m => [
        m.label,
        m.patientCount,
        m.invoiceCount,
        m.totalBilled.toFixed(2),
        m.totalPaid.toFixed(2)
      ])
    ];
    
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Top patients worksheet
    const patientsData = [
      ['Top Patients by Payment Amount'],
      [],
      ['Patient Name', 'Email', 'Phone', 'Invoices', 'Billed (CHF)', 'Paid (CHF)'],
      ...data.groups.byPatient.map(p => [
        p.label,
        p.email || '',
        p.phone || '',
        p.invoiceCount,
        p.totalBilled.toFixed(2),
        p.totalPaid.toFixed(2)
      ])
    ];
    
    const wsPatients = XLSX.utils.aoa_to_sheet(patientsData);
    XLSX.utils.book_append_sheet(wb, wsPatients, 'Top Patients');
    
    // Detail payments worksheet
    const detailData = [
      ['Payment Details'],
      [],
      ['Payment Date', 'Payment Method', 'Amount (CHF)', 'Invoice Number', 'Invoice Date', 
       'Invoice Total (CHF)', 'Invoice Paid (CHF)', 'Status', 'Patient Name', 'Patient Email', 'Patient Phone', 'Notes'],
      ...data.rows.map(r => [
        r.payment_date,
        r.payment_method || '',
        r.amount.toFixed(2),
        r.invoice_number,
        r.invoice_date,
        r.invoice_total.toFixed(2),
        r.invoice_paid.toFixed(2),
        r.invoice_status,
        `${r.patient_last_name || ''} ${r.patient_first_name || ''}`.trim(),
        r.patient_email || '',
        r.patient_phone || '',
        r.notes || ''
      ])
    ];
    
    const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Payment Details');
    
    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Create filename with location and date range
    const locationStr = location ? location.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Locations';
    const filename = `Agenda_Patients_Payments_${locationStr}_${from}_to_${to}.xlsx`;
    
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
    
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}