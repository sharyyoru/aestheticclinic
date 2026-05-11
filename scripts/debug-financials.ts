// Debug script to analyze invoice payment data
// Run with: npx tsx scripts/debug-financials.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugFinancials() {
  console.log("=== INVOICE PAYMENT DATA ANALYSIS ===\n");

  // 1. Get total counts by status for 2025
  const { data: statusCounts, error: statusError } = await supabase
    .from("invoices")
    .select("status, total_amount, paid_amount")
    .eq("is_archived", false)
    .is("parent_invoice_id", null)
    .gte("invoice_date", "2024-12-31")
    .lte("invoice_date", "2025-12-31");

  if (statusError) {
    console.error("Error fetching invoices:", statusError);
    return;
  }

  // Aggregate by status
  const byStatus: Record<string, { count: number; totalAmount: number; paidAmount: number }> = {};
  
  for (const inv of statusCounts || []) {
    const status = inv.status || "NULL";
    if (!byStatus[status]) {
      byStatus[status] = { count: 0, totalAmount: 0, paidAmount: 0 };
    }
    byStatus[status].count++;
    byStatus[status].totalAmount += Number(inv.total_amount) || 0;
    byStatus[status].paidAmount += Number(inv.paid_amount) || 0;
  }

  console.log("INVOICES BY STATUS (2025):");
  console.log("─".repeat(80));
  let grandTotalAmount = 0;
  let grandPaidAmount = 0;
  
  for (const [status, data] of Object.entries(byStatus).sort((a, b) => b[1].totalAmount - a[1].totalAmount)) {
    console.log(`${status.padEnd(15)} | Count: ${String(data.count).padStart(5)} | Total: ${data.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }).padStart(15)} CHF | Paid: ${data.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }).padStart(15)} CHF`);
    grandTotalAmount += data.totalAmount;
    grandPaidAmount += data.paidAmount;
  }
  
  console.log("─".repeat(80));
  console.log(`${"TOTAL".padEnd(15)} | Count: ${String(statusCounts?.length || 0).padStart(5)} | Total: ${grandTotalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }).padStart(15)} CHF | Paid: ${grandPaidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }).padStart(15)} CHF`);

  // 2. Check for invoices where paid_amount > 0 but status is not PAID
  const { data: mismatch, error: mismatchError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_amount, paid_amount")
    .eq("is_archived", false)
    .is("parent_invoice_id", null)
    .gte("invoice_date", "2024-12-31")
    .lte("invoice_date", "2025-12-31")
    .gt("paid_amount", 0)
    .not("status", "in", "(PAID,OVERPAID)");

  console.log("\n\nINVOICES WITH paid_amount > 0 BUT status NOT PAID/OVERPAID:");
  console.log("─".repeat(80));
  
  let mismatchTotal = 0;
  let mismatchPaid = 0;
  
  for (const inv of (mismatch || []).slice(0, 20)) {
    console.log(`${inv.invoice_number || inv.id} | Status: ${inv.status?.padEnd(12)} | Total: ${(inv.total_amount || 0).toLocaleString()} CHF | Paid: ${(inv.paid_amount || 0).toLocaleString()} CHF`);
    mismatchTotal += Number(inv.total_amount) || 0;
    mismatchPaid += Number(inv.paid_amount) || 0;
  }
  
  if ((mismatch?.length || 0) > 20) {
    console.log(`... and ${(mismatch?.length || 0) - 20} more`);
  }
  
  console.log("─".repeat(80));
  console.log(`MISMATCH TOTAL: ${mismatch?.length || 0} invoices | Total Amount: ${mismatchTotal.toLocaleString()} CHF | Paid Amount: ${mismatchPaid.toLocaleString()} CHF`);

  // 3. Check for PAID invoices with NULL or 0 paid_amount
  const { data: paidNoAmount, error: paidNoAmountError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_amount, paid_amount")
    .eq("is_archived", false)
    .is("parent_invoice_id", null)
    .gte("invoice_date", "2024-12-31")
    .lte("invoice_date", "2025-12-31")
    .in("status", ["PAID", "OVERPAID"])
    .or("paid_amount.is.null,paid_amount.eq.0");

  console.log("\n\nPAID/OVERPAID INVOICES WITH NULL OR 0 paid_amount:");
  console.log("─".repeat(80));
  
  let paidNoAmountTotal = 0;
  
  for (const inv of (paidNoAmount || []).slice(0, 10)) {
    console.log(`${inv.invoice_number || inv.id} | Status: ${inv.status?.padEnd(12)} | Total: ${(inv.total_amount || 0).toLocaleString()} CHF | Paid: ${inv.paid_amount ?? "NULL"}`);
    paidNoAmountTotal += Number(inv.total_amount) || 0;
  }
  
  if ((paidNoAmount?.length || 0) > 10) {
    console.log(`... and ${(paidNoAmount?.length || 0) - 10} more`);
  }
  
  console.log("─".repeat(80));
  console.log(`PAID WITH NO AMOUNT: ${paidNoAmount?.length || 0} invoices | Total Amount: ${paidNoAmountTotal.toLocaleString()} CHF`);
  console.log("\nThese PAID invoices should have paid_amount = total_amount!");

  // 4. Summary calculation
  console.log("\n\n=== CORRECTED CALCULATION ===");
  console.log("─".repeat(80));
  
  let correctPaid = 0;
  
  for (const inv of statusCounts || []) {
    if (inv.status === "CANCELLED") continue;
    
    const total = Number(inv.total_amount) || 0;
    const paid = Number(inv.paid_amount) || 0;
    
    if (inv.status === "PAID" || inv.status === "OVERPAID") {
      // For PAID status, if paid_amount is 0/null, use total_amount
      correctPaid += paid > 0 ? paid : total;
    } else if (paid > 0) {
      // For other statuses, use actual paid_amount
      correctPaid += paid;
    }
  }
  
  console.log(`Corrected Total Paid: ${correctPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })} CHF`);
  console.log(`Current Showing:      ${grandPaidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} CHF (from paid_amount field)`);
  console.log(`Difference:           ${(correctPaid - grandPaidAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })} CHF`);
}

async function checkBankPayments() {
  console.log("\n\n=== BANK PAYMENT IMPORTS ===\n");
  
  // Check bank_payment_imports
  const { data: imports, error: importsError } = await supabase
    .from("bank_payment_imports")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(10);

  if (importsError) {
    console.log("Error or no bank_payment_imports table:", importsError.message);
  } else {
    console.log(`Found ${imports?.length || 0} payment imports`);
    for (const imp of imports || []) {
      console.log(`- ${imp.file_name || imp.id}: ${imp.total_amount || 'N/A'} CHF, ${imp.matched_count || 0} matched`);
    }
  }

  // Try to query invoice_payments if it exists
  const { data: payments, error: paymentsError } = await supabase
    .from("invoice_payments")
    .select("*")
    .limit(5);

  if (!paymentsError && payments) {
    console.log("\n\nFound invoice_payments table with", payments.length, "rows (showing first 5)");
  }
}

debugFinancials().then(checkBankPayments).catch(console.error);
