import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Recommendation engine based on docs/MEDIDATA_PATTERNS_AND_LEARNINGS.md ──

const ERROR_CODE_ACTIONS: Record<string, { action: string; category: string }> = {
  // Duplicate / Already on file — DO NOT RESEND
  "121": { action: "DO NOT resend. Insurer confirms invoice is already paid OR being processed. Do NOT mark as paid — the message is ambiguous. Contact insurer directly to confirm payment status outside MediData.", category: "DO NOT RESEND" },
  "000125": { action: "DO NOT resend. Insurer already received the same invoice and is processing it. This is a duplicate submission — check if the invoice was sent twice and prevent future duplicates.", category: "DO NOT RESEND" },
  "135": { action: "DO NOT resend. Invoice was billed twice (double calculation). Identify the duplicate submission and cancel/storno it. Review submission workflow to prevent duplicates.", category: "DO NOT RESEND" },
  "406": { action: "DO NOT resend. The original invoice is still being processed by the insurer. This response is typically for a copy or storno — the original is in their queue. Wait for the original's accepted/rejected response.", category: "DO NOT RESEND" },
  "4.102.000": { action: "DO NOT resend. Insurer already received this invoice number on the specified date. This is a duplicate — cancel the duplicate submission and review the sending workflow.", category: "DO NOT RESEND" },

  // Tariff code errors — FIX AND RESEND
  "5.104.002": { action: "FIX TARIFF CODES AND RESEND. Tariff positions AA00.0010/AA00.0020 are not recognized with tariff type 001 (TARMED legacy). Update to tariff_type=007 (TARDOC) and verify codes against current TARDOC reference data.", category: "FIX AND RESEND" },
  "500": { action: "FIX TARIFF CODES AND RESEND. Tariff positions AA00.0010/AA00.0020 are not valid in TARDOC tariff 007. Replace with equivalent TARDOC codes and resend. Verify at forum-datenaustausch.ch.", category: "FIX AND RESEND" },
  "V72": { action: "FIX TARIFF CODES AND RESEND. The billed tariff code is not valid. Check the current TARDOC tariff catalog and use a valid code for the service rendered.", category: "FIX AND RESEND" },
  "eK5.3.3": { action: "FIX TARIFF CODES AND RESEND. Insurer refuses because tariff type and/or code is incorrect. Use TARDOC (tariff type 007) with correct tax point value for the canton (e.g., 0.91 for Geneva). Most frequent rejection — prioritize fixing tariff configuration.", category: "FIX AND RESEND" },
  "eK6.T001": { action: "FIX TAX POINT VALUE AND RESEND. The tax point value (Taxpunktwert) for the consultation is too high. Insurer expects a lower value (e.g., 0.91 for Geneva canton instead of 1.00). Update tax_point_value and resend.", category: "FIX AND RESEND" },
  "TP2": { action: "FIX TAX POINT VALUE AND RESEND. The tax point value (TPWAL) is 1.00 but insurer expects 0.94. Update tax_point_value to match the canton's reference value and resend.", category: "FIX AND RESEND" },
  "NA5": { action: "STORNO AND RESEND WITH CORRECT CODES. The tariff position was not valid at the time of service. Cancel (storno) the original invoice and create a new one with the correct tariff code that was valid on the service date.", category: "FIX AND RESEND" },
  "NE1": { action: "INFORMATIONAL — TARDOC migration notice. Invoice used TARMED codes (tariff_type 001) which are no longer valid since 01.01.2026. Resend with TARDOC codes (tariff_type 007).", category: "FIX AND RESEND" },

  // Patient billing — BILL PATIENT DIRECTLY
  "171": { action: "BILL THE PATIENT DIRECTLY. Insurer does not cover these treatments directly. Create a new invoice as TG (Tiers Garant — patient pays) and send it to the patient instead of the insurer.", category: "BILL PATIENT" },
  "999": { action: "DO NOT BILL THIS INSURER. Insurer refuses coverage based on a prior notice/letter. Check if patient has a different insurance that covers this treatment, or bill the patient directly (TG).", category: "BILL PATIENT" },

  // Patient identification — FIX PATIENT DATA AND RESEND
  "2.301.000": { action: "FIX PATIENT DATA AND RESEND. Insurer could not identify the patient. Verify insurance number, name, and date of birth. Ensure the correct insurance card was scanned and data matches exactly.", category: "FIX PATIENT DATA" },
  "eK2.3.1": { action: "FIX PATIENT DATA AND RESEND. The insured person is unknown to the insurer. Verify the patient's insurance number and personal data. The patient may have changed insurance — check with the patient directly.", category: "FIX PATIENT DATA" },

  // Service not billable — REMOVE AND RESEND
  "13": { action: "REMOVE LINE ITEM AND RESEND. The service described is not billable. Remove this line item from the invoice and resend, or bill it directly to the patient if applicable.", category: "REMOVE AND RESEND" },

  // XML schema error — NO ACTION (staging only)
  "eK1.1.1": { action: "FIX XML GENERATION AND RESEND. The generated XML does not conform to the XML Schema standard. This is a software bug in the Sumex XML generation, not a billing issue. Contact development team.", category: "FIX XML" },
};

function getRecommendation(row: {
  final_category: string;
  fully_paid: boolean;
  has_storno: boolean;
  storno_status: string;
  is_duplicate: boolean;
  routing_correct: string;
  sent_to_medidata: boolean;
  age_days: number;
  rejection_reason: string;
  insurance_name: string;
}): { recommendation: string; action_category: string } {
  // 1. Duplicate — archive
  if (row.is_duplicate) {
    return {
      recommendation: "ARCHIVE — paid replacement invoice exists. Mark this invoice as CANCELLED. No resend needed.",
      action_category: "ARCHIVE",
    };
  }

  // 2. Already paid — no action
  if (row.fully_paid) {
    return {
      recommendation: "NO ACTION — invoice is fully paid.",
      action_category: "NO ACTION",
    };
  }

  // 3. Stornoed, never resent
  if (row.storno_status === "NOT_RESENT") {
    return {
      recommendation: `RESEND — stornoed but no replacement was sent. Correct the service data (check tariff codes, use TARDOC tariff_type=007) and resend as a new invoice. Amount at risk.`,
      action_category: "RESEND",
    };
  }

  // 4. Stornoed, resent but not paid
  if (row.storno_status === "RESENT_NOT_PAID") {
    return {
      recommendation: "FOLLOW UP — replacement invoice was sent but not yet paid. Check with insurer for status.",
      action_category: "FOLLOW UP",
    };
  }

  // 5. Stornoed, cancelled
  if (row.storno_status === "CANCELLED") {
    return {
      recommendation: "VERIFY — invoice was cancelled. Check if a replacement was sent manually outside the system.",
      action_category: "VERIFY",
    };
  }

  // 6. Not sent to MediData
  if (!row.sent_to_medidata) {
    return {
      recommendation: "SEND — invoice has not been submitted to MediData yet. Send it now.",
      action_category: "SEND",
    };
  }

  // 7. Wrong routing, still unpaid
  if (row.routing_correct === "NO" && !row.fully_paid) {
    return {
      recommendation: "RESEND — invoice was sent to the wrong insurer GLN. The routing bug has been fixed. Resend with the correct insurer GLN.",
      action_category: "RESEND",
    };
  }

  // 8. Rejected — check error code for specific recommendation
  if (row.final_category === "REJECTED") {
    // Try to extract error code from rejection_reason
    const reason = row.rejection_reason || "";
    // Error code is at the start before ":"
    const codeMatch = reason.match(/^([a-zA-Z0-9.]+):/);
    const code = codeMatch?.[1] || "";

    if (code && ERROR_CODE_ACTIONS[code]) {
      const action = ERROR_CODE_ACTIONS[code];
      return {
        recommendation: action.action,
        action_category: action.category,
      };
    }

    // Unknown rejection code
    return {
      recommendation: `REVIEW REJECTION — insurer rejected this invoice. Reason: "${reason.substring(0, 150)}". Contact insurer or check error code documentation for specific action.`,
      action_category: "REVIEW",
    };
  }

  // 9. Transmitted (pending), correct routing, not paid
  if (row.final_category === "TRANSMITTED" && !row.fully_paid) {
    if (row.age_days > 90) {
      return {
        recommendation: "CONTACT INSURER — invoice has been transmitted for 90+ days with no response. The insurer response may have expired on MediData's queue. Contact MediData support or the insurer directly to resend the response.",
        action_category: "CONTACT INSURER",
      };
    } else if (row.age_days > 30) {
      return {
        recommendation: "FOLLOW UP — invoice has been transmitted for 30+ days with no insurer response. Run a manual poll (POST /api/medidata/poll) to check for pending responses. If still no response, contact the insurer directly.",
        action_category: "FOLLOW UP",
      };
    } else {
      return {
        recommendation: "WAIT — invoice was recently transmitted. The insurer has up to 30 days to respond. No action needed yet.",
        action_category: "WAIT",
      };
    }
  }

  // 10. Accepted
  if (row.final_category === "ACCEPTED") {
    return {
      recommendation: "NO ACTION — invoice was accepted by the insurer. Payment should follow.",
      action_category: "NO ACTION",
    };
  }

  // 11. Draft
  if (row.final_category === "DRAFT") {
    return {
      recommendation: "SEND — invoice is in draft status. Complete and submit to MediData.",
      action_category: "SEND",
    };
  }

  // 12. Other
  return {
    recommendation: "REVIEW — check invoice status and submission history for details.",
    action_category: "REVIEW",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "2026-04-01";
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const agingMinDays = parseInt(searchParams.get("agingMinDays") || "0", 10);

  // Use larger batch size (Supabase supports up to 1000 in `in()`)
  const BATCH = 200;

  // ── 1. Get all insurance invoices in date range ──
  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select(
      "id, invoice_number, patient_id, invoice_date, total_amount, paid_amount, status, billing_type, insurance_gln, insurance_name, insurance_paid_amount, created_at",
    )
    .gte("invoice_date", from)
    .lte("invoice_date", to)
    .order("invoice_date", { ascending: true });

  if (!invoices) {
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }

  // Filter to insurance invoices (TP or has insurance GLN that isn't the no-transmission GLN)
  const insuranceInvoices = invoices.filter(
    (inv) => inv.billing_type === "TP" || (inv.insurance_gln && inv.insurance_gln !== "2000000000008"),
  );

  const invoiceIds = insuranceInvoices.map((i) => i.id);
  if (invoiceIds.length === 0) {
    return NextResponse.json({ rows: [], summary: {}, agingBuckets: {} });
  }

  // ── 2. Get patients (single batch, usually < 200) ──
  const patientIds = [...new Set(insuranceInvoices.map((i) => i.patient_id).filter(Boolean))];
  const patientMap: Record<string, { first_name: string; last_name: string }> = {};
  for (let i = 0; i < patientIds.length; i += BATCH) {
    const { data } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name")
      .in("id", patientIds.slice(i, i + BATCH));
    for (const p of data || []) {
      patientMap[p.id] = { first_name: p.first_name, last_name: p.last_name };
    }
  }

  // ── 3. Get submissions for these invoices (WITHOUT xml_content — fetched separately) ──
  const subsByInvoice: Record<string, any[]> = {};
  for (let i = 0; i < invoiceIds.length; i += BATCH) {
    const { data } = await supabaseAdmin
      .from("medidata_submissions")
      .select(
        "id, invoice_id, invoice_number, status, created_at, is_storno, storno_reason, insurance_response_code, insurance_response_message, medidata_response_code, medidata_message_id",
      )
      .in("invoice_id", invoiceIds.slice(i, i + BATCH))
      .order("created_at", { ascending: true });
    for (const s of data || []) {
      if (!subsByInvoice[s.invoice_id]) subsByInvoice[s.invoice_id] = [];
      subsByInvoice[s.invoice_id].push(s);
    }
  }

  // ── 3b. Fetch xml_content ONLY for invoices that have non-storno submissions (for routing check) ──
  const invoicesWithSubs = invoiceIds.filter((id) => {
    const subs = subsByInvoice[id] || [];
    return subs.some((s) => !s.is_storno);
  });
  const xmlByInvoice: Record<string, string> = {};
  for (let i = 0; i < invoicesWithSubs.length; i += BATCH) {
    const batchIds = invoicesWithSubs.slice(i, i + BATCH);
    const { data } = await supabaseAdmin
      .from("medidata_submissions")
      .select("invoice_id, xml_content, is_storno, created_at")
      .in("invoice_id", batchIds)
      .eq("is_storno", false)
      .order("created_at", { ascending: true })
      .limit(batchIds.length * 2); // Usually 1 per invoice, but allow for retries
    for (const s of data || []) {
      // Only keep the first non-storno submission's XML per invoice
      if (!xmlByInvoice[s.invoice_id] && s.xml_content) {
        xmlByInvoice[s.invoice_id] = s.xml_content;
      }
    }
  }

  // ── 4. Get bank payments ──
  const bpByInvoice: Record<string, any[]> = {};
  for (let i = 0; i < invoiceIds.length; i += BATCH) {
    const { data } = await supabaseAdmin
      .from("bank_payment_import_items")
      .select("matched_invoice_id, amount, booking_date, debtor_name, ultimate_debtor_name")
      .in("matched_invoice_id", invoiceIds.slice(i, i + BATCH));
    for (const bp of data || []) {
      if (!bpByInvoice[bp.matched_invoice_id]) bpByInvoice[bp.matched_invoice_id] = [];
      bpByInvoice[bp.matched_invoice_id].push(bp);
    }
  }

  // ── 5. Duplicate + replacement detection ──
  // Instead of fetching ALL invoices for ALL patients, use targeted queries:
  // a) For duplicates: same patient + same insurer_gln + similar amount + within 1 day
  // b) For storno replacements: same patient + same insurer_gln + similar amount + after storno date

  // First, collect all unique (patient_id, insurance_gln) pairs
  const patientInsurerPairs = new Set<string>();
  for (const inv of insuranceInvoices) {
    if (inv.patient_id && inv.insurance_gln) {
      patientInsurerPairs.add(`${inv.patient_id}|${inv.insurance_gln}`);
    }
  }

  // Fetch ALL invoices for these patient+insurer combos (much smaller set than all patient invoices)
  const allPatientInvoices: Record<string, any[]> = {};
  const pairArr = [...patientInsurerPairs];
  for (let i = 0; i < pairArr.length; i += BATCH) {
    const batchPairs = pairArr.slice(i, i + BATCH);
    // Query by patient_id IN (...) — we'll filter by insurer_gln in JS
    const batchPatientIds = [...new Set(batchPairs.map(p => p.split("|")[0]))];
    const { data } = await supabaseAdmin
      .from("invoices")
      .select(
        "id, invoice_number, patient_id, invoice_date, total_amount, status, billing_type, insurance_gln, insurance_name, insurance_paid_amount, paid_amount",
      )
      .in("patient_id", batchPatientIds)
      .order("invoice_date", { ascending: true });
    for (const inv of data || []) {
      // Only keep invoices matching one of our patient+insurer pairs
      const key = `${inv.patient_id}|${inv.insurance_gln}`;
      if (patientInsurerPairs.has(key)) {
        if (!allPatientInvoices[inv.patient_id]) allPatientInvoices[inv.patient_id] = [];
        allPatientInvoices[inv.patient_id].push(inv);
      }
    }
  }

  // Get submissions + bank payments ONLY for the patient invoices we actually fetched
  const allPatientInvoiceIds = [...new Set(Object.values(allPatientInvoices).flat().map((i: any) => i.id))];
  const allSubsByInv: Record<string, any[]> = {};
  for (let i = 0; i < allPatientInvoiceIds.length; i += BATCH) {
    const { data } = await supabaseAdmin
      .from("medidata_submissions")
      .select("id, invoice_id, status, is_storno")
      .in("invoice_id", allPatientInvoiceIds.slice(i, i + BATCH));
    for (const s of data || []) {
      if (!allSubsByInv[s.invoice_id]) allSubsByInv[s.invoice_id] = [];
      allSubsByInv[s.invoice_id].push(s);
    }
  }
  const allBpByInv: Record<string, any[]> = {};
  for (let i = 0; i < allPatientInvoiceIds.length; i += BATCH) {
    const { data } = await supabaseAdmin
      .from("bank_payment_import_items")
      .select("matched_invoice_id, amount, debtor_name, ultimate_debtor_name")
      .in("matched_invoice_id", allPatientInvoiceIds.slice(i, i + BATCH));
    for (const bp of data || []) {
      if (!allBpByInv[bp.matched_invoice_id]) allBpByInv[bp.matched_invoice_id] = [];
      allBpByInv[bp.matched_invoice_id].push(bp);
    }
  }

  // ── 6. Analyze each invoice ──
  const now = Date.now();
  const rows: any[] = [];

  for (const inv of insuranceInvoices) {
    const patient = patientMap[inv.patient_id];
    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "?";
    const invSubs = subsByInvoice[inv.id] || [];
    const nonStorno = invSubs.filter((s) => !s.is_storno);
    const stornos = invSubs.filter((s) => s.is_storno);
    const hasSubmissions = nonStorno.length > 0;

    // Bank payments
    const invBp = bpByInvoice[inv.id] || [];
    const insBp = invBp.filter((bp) => {
      const d = bp.ultimate_debtor_name || bp.debtor_name || "";
      return /insur|krankenkasse|assurance|mutuel|agrisano|helsana|css|sanitas|assura|sympany|visana|atupri|groupe|aerosana|philos|gma|avenir|kpt|cpt|unsmis|ung/i.test(d);
    });
    const bankPaid = insBp.reduce((s, bp) => s + Number(bp.amount), 0);
    const totalPaid = bankPaid + Number(inv.insurance_paid_amount || 0) + Number(inv.paid_amount || 0);
    const invTotal = Number(inv.total_amount) || 0;
    const isFullyPaid = totalPaid >= invTotal * 0.9 && invTotal > 0;

    // Submission status
    let submissionStatus = "NOT_SENT";
    let sentToMedidata = false;

    if (hasSubmissions) {
      sentToMedidata = true;
      const rejected = nonStorno.filter((s) => s.status === "rejected");
      const transmitted = nonStorno.filter((s) => s.status === "transmitted");
      const accepted = nonStorno.filter((s) => s.status === "accepted");
      const draft = nonStorno.filter((s) => s.status === "draft" || s.status === "pending");

      if (isFullyPaid) {
        submissionStatus = "PAID";
      } else if (stornos.length > 0 && nonStorno.length === 0) {
        submissionStatus = "STORNOED";
      } else if (rejected.length > 0 && transmitted.length === 0) {
        submissionStatus = "REJECTED";
      } else if (transmitted.length > 0) {
        submissionStatus = "TRANSMITTED";
      } else if (accepted.length > 0) {
        submissionStatus = "ACCEPTED";
      } else if (draft.length > 0) {
        submissionStatus = "DRAFT";
        sentToMedidata = false;
      } else {
        submissionStatus = "OTHER";
      }
    }

    // Storno analysis
    const hasStorno = stornos.length > 0;
    const stornoReason = stornos[0]?.storno_reason || "";
    const isA10A20 = /A10|A20|incorrect service|codes de prestations|erroné|falsche leistungsdaten|technical error/i.test(stornoReason);

    // Check if resent (replacement invoice exists)
    const patientInvs = allPatientInvoices[inv.patient_id] || [];
    const replacements = patientInvs.filter((other: any) => {
      if (other.id === inv.id) return false;
      if (other.insurance_gln !== inv.insurance_gln) return false;
      const amountDiff = Math.abs(Number(other.total_amount) - invTotal);
      if (amountDiff > 5.0) return false;
      return new Date(other.invoice_date) >= new Date(stornos[0]?.created_at || inv.invoice_date);
    });
    const paidReplacements = replacements.filter((rep: any) => {
      const repBp = allBpByInv[rep.id] || [];
      const repPaid = repBp.reduce((s: number, bp: any) => s + Number(bp.amount), 0) + Number(rep.insurance_paid_amount || 0) + Number(rep.paid_amount || 0);
      return repPaid >= Number(rep.total_amount) * 0.9;
    });

    let stornoStatus = "N/A";
    if (hasStorno) {
      if (isFullyPaid) {
        stornoStatus = "PAID_DESPITE_STORNO";
      } else if (paidReplacements.length > 0) {
        stornoStatus = "RESENT_PAID";
      } else if (replacements.length > 0) {
        stornoStatus = "RESENT_NOT_PAID";
      } else if (inv.status === "CANCELLED") {
        stornoStatus = "CANCELLED";
      } else {
        stornoStatus = "NOT_RESENT";
      }
    }

    // Duplicate detection
    const duplicates = patientInvs.filter((other: any) => {
      if (other.id === inv.id) return false;
      if (other.insurance_gln !== inv.insurance_gln) return false;
      const amountDiff = Math.abs(Number(other.total_amount) - invTotal);
      if (amountDiff > 0.5) return false;
      const dateDiff = Math.abs(new Date(other.invoice_date).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24);
      return dateDiff <= 1;
    });
    const paidDuplicates = duplicates.filter((dup: any) => {
      const dupBp = allBpByInv[dup.id] || [];
      const dupPaid = dupBp.reduce((s: number, bp: any) => s + Number(bp.amount), 0) + Number(dup.insurance_paid_amount || 0) + Number(dup.paid_amount || 0);
      return dupPaid >= Number(dup.total_amount) * 0.9;
    });

    let isDuplicate = false;
    let duplicateDetail = "";
    if (paidDuplicates.length > 0 && !isFullyPaid) {
      isDuplicate = true;
      duplicateDetail = `DUPLICATE — ${paidDuplicates[0].invoice_number} was paid`;
    } else if (duplicates.length > 0 && !isFullyPaid) {
      const sortedDups = [inv, ...duplicates].sort((a: any, b: any) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime());
      if (sortedDups[0].id === inv.id) {
        const newerDup = duplicates.find((d: any) => new Date(d.invoice_date) > new Date(inv.invoice_date));
        if (newerDup) {
          const newerBp = allBpByInv[newerDup.id] || [];
          const newerPaid = newerBp.reduce((s: number, bp: any) => s + Number(bp.amount), 0) + Number(newerDup.insurance_paid_amount || 0) + Number(newerDup.paid_amount || 0);
          if (newerPaid >= Number(newerDup.total_amount) * 0.9) {
            isDuplicate = true;
            duplicateDetail = `DUPLICATE — ${newerDup.invoice_number} (newer) was paid`;
          } else {
            duplicateDetail = `POSSIBLE DUPLICATE — ${duplicates.map((d: any) => d.invoice_number).join(", ")}`;
          }
        }
      }
    }

    // Routing check (from XML — fetched separately for performance)
    let routingCorrect: "YES" | "NO" | "N/A" = "N/A";
    let routedToGln = "";
    let routedToName = "";
    const xmlContent = xmlByInvoice[inv.id];
    if (xmlContent) {
      const tm = xmlContent.match(/<invoice:transport\s+from="([^"]+)"\s+to="([^"]+)"/);
      routedToGln = tm?.[2] || "";
      const dm = xmlContent.match(/<invoice:debitor\s+gln="([^"]+)">[\s\S]*?<invoice:companyname>([^<]+)<\/invoice:companyname>/);
      routedToName = dm?.[2] || "";
      if (routedToGln && inv.insurance_gln) {
        routingCorrect = routedToGln === inv.insurance_gln ? "YES" : "NO";
      }
    }

    // Aging
    const firstSubDate = nonStorno[0]?.created_at || inv.created_at;
    const ageDays = firstSubDate ? Math.round((now - new Date(firstSubDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Final category
    let finalCategory = submissionStatus;
    if (isDuplicate) finalCategory = "DUPLICATE";

    // Bank payment detail
    const bankDetail = insBp.length > 0
      ? insBp.map((bp) => `CHF ${bp.amount} from "${bp.ultimate_debtor_name || bp.debtor_name}" on ${bp.booking_date}`).join("; ")
      : "";

    // Rejection reason
    const rejectedSubs = nonStorno.filter((s) => s.status === "rejected");
    const rejectionReason = rejectedSubs.length > 0
      ? `${rejectedSubs[rejectedSubs.length - 1].insurance_response_code || ""}: ${(rejectedSubs[rejectedSubs.length - 1].insurance_response_message || "").substring(0, 200)}`.trim()
      : "";

    const row: any = {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      patient_name: patientName,
      invoice_date: inv.invoice_date,
      amount: invTotal,
      billing_type: inv.billing_type,
      insurance_name: inv.insurance_name || "",
      insurance_gln: inv.insurance_gln || "",
      invoice_status: inv.status,
      sent_to_medidata: sentToMedidata,
      submission_status: submissionStatus,
      final_category: finalCategory,
      total_paid: totalPaid,
      fully_paid: isFullyPaid,
      has_storno: hasStorno,
      storno_reason: stornoReason.substring(0, 200),
      storno_status: stornoStatus,
      is_a10_a20: isA10A20,
      was_resent: replacements.length > 0,
      replacement_paid: paidReplacements.length > 0,
      replacement_invoices: replacements.map((r: any) => r.invoice_number).join(", "),
      is_duplicate: isDuplicate,
      duplicate_detail: duplicateDetail,
      routing_correct: routingCorrect,
      routed_to_gln: routedToGln,
      routed_to_name: routedToName,
      age_days: ageDays,
      rejection_reason: rejectionReason,
      bank_paid: bankPaid,
      bank_detail: bankDetail,
    };

    // Generate recommendation
    const rec = getRecommendation({
      final_category: row.final_category,
      fully_paid: row.fully_paid,
      has_storno: row.has_storno,
      storno_status: row.storno_status,
      is_duplicate: row.is_duplicate,
      routing_correct: row.routing_correct,
      sent_to_medidata: row.sent_to_medidata,
      age_days: row.age_days,
      rejection_reason: row.rejection_reason,
      insurance_name: row.insurance_name,
    });
    row.recommendation = rec.recommendation;
    row.action_category = rec.action_category;

    rows.push(row);
  }

  // ── 7. Build summary ──
  const summary = {
    total_invoices: insuranceInvoices.length,
    total_amount: insuranceInvoices.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
    sent: rows.filter((r) => r.sent_to_medidata).length,
    sent_amount: rows.filter((r) => r.sent_to_medidata).reduce((s, r) => s + r.amount, 0),
    not_sent: rows.filter((r) => !r.sent_to_medidata).length,
    not_sent_amount: rows.filter((r) => !r.sent_to_medidata).reduce((s, r) => s + r.amount, 0),
    paid: rows.filter((r) => r.final_category === "PAID" || r.final_category === "ACCEPTED").length,
    paid_amount: rows.filter((r) => r.final_category === "PAID" || r.final_category === "ACCEPTED").reduce((s, r) => s + r.amount, 0),
    rejected: rows.filter((r) => r.final_category === "REJECTED").length,
    rejected_amount: rows.filter((r) => r.final_category === "REJECTED").reduce((s, r) => s + r.amount, 0),
    transmitted: rows.filter((r) => r.final_category === "TRANSMITTED").length,
    transmitted_amount: rows.filter((r) => r.final_category === "TRANSMITTED").reduce((s, r) => s + r.amount, 0),
    stornoed: rows.filter((r) => r.has_storno).length,
    stornoed_amount: rows.filter((r) => r.has_storno).reduce((s, r) => s + r.amount, 0),
    stornoed_not_resent: rows.filter((r) => r.storno_status === "NOT_RESENT").length,
    stornoed_not_resent_amount: rows.filter((r) => r.storno_status === "NOT_RESENT").reduce((s, r) => s + r.amount, 0),
    stornoed_resent_paid: rows.filter((r) => r.storno_status === "RESENT_PAID").length,
    stornoed_resent_not_paid: rows.filter((r) => r.storno_status === "RESENT_NOT_PAID").length,
    stornoed_a10_a20: rows.filter((r) => r.is_a10_a20).length,
    duplicates: rows.filter((r) => r.is_duplicate).length,
    duplicates_amount: rows.filter((r) => r.is_duplicate).reduce((s, r) => s + r.amount, 0),
    wrong_routing: rows.filter((r) => r.routing_correct === "NO").length,
    wrong_routing_amount: rows.filter((r) => r.routing_correct === "NO").reduce((s, r) => s + r.amount, 0),
    wrong_routing_unpaid: rows.filter((r) => r.routing_correct === "NO" && !r.fully_paid).length,
    wrong_routing_unpaid_amount: rows.filter((r) => r.routing_correct === "NO" && !r.fully_paid).reduce((s, r) => s + r.amount, 0),
    wrong_routing_paid: rows.filter((r) => r.routing_correct === "NO" && r.fully_paid).length,
    // Action-needed buckets
    action_resend_stornoed: rows.filter((r) => r.storno_status === "NOT_RESENT").length,
    action_resend_stornoed_amount: rows.filter((r) => r.storno_status === "NOT_RESENT").reduce((s, r) => s + r.amount, 0),
    action_resend_wrong_routing: rows.filter((r) => r.routing_correct === "NO" && !r.fully_paid && r.final_category !== "REJECTED").length,
    action_resend_wrong_routing_amount: rows.filter((r) => r.routing_correct === "NO" && !r.fully_paid && r.final_category !== "REJECTED").reduce((s, r) => s + r.amount, 0),
    action_follow_up_transmitted: rows.filter((r) => r.final_category === "TRANSMITTED" && !r.fully_paid && r.routing_correct === "YES").length,
    action_follow_up_transmitted_amount: rows.filter((r) => r.final_category === "TRANSMITTED" && !r.fully_paid && r.routing_correct === "YES").reduce((s, r) => s + r.amount, 0),
    action_follow_up_rejected: rows.filter((r) => r.final_category === "REJECTED" && !r.fully_paid).length,
    action_follow_up_rejected_amount: rows.filter((r) => r.final_category === "REJECTED" && !r.fully_paid).reduce((s, r) => s + r.amount, 0),
    action_archive_duplicates: rows.filter((r) => r.is_duplicate).length,
    action_archive_duplicates_amount: rows.filter((r) => r.is_duplicate).reduce((s, r) => s + r.amount, 0),
    action_send_not_sent: rows.filter((r) => !r.sent_to_medidata).length,
    action_send_not_sent_amount: rows.filter((r) => !r.sent_to_medidata).reduce((s, r) => s + r.amount, 0),
  };

  // ── 8. Aging buckets for transmitted (unpaid) invoices ──
  const transmittedUnpaid = rows.filter((r) => r.final_category === "TRANSMITTED" && !r.fully_paid);
  const agingBuckets = {
    "0-7": transmittedUnpaid.filter((r) => r.age_days <= 7).length,
    "8-30": transmittedUnpaid.filter((r) => r.age_days > 7 && r.age_days <= 30).length,
    "31-60": transmittedUnpaid.filter((r) => r.age_days > 30 && r.age_days <= 60).length,
    "61-90": transmittedUnpaid.filter((r) => r.age_days > 60 && r.age_days <= 90).length,
    "90+": transmittedUnpaid.filter((r) => r.age_days > 90).length,
  };
  const agingAmounts = {
    "0-7": transmittedUnpaid.filter((r) => r.age_days <= 7).reduce((s, r) => s + r.amount, 0),
    "8-30": transmittedUnpaid.filter((r) => r.age_days > 7 && r.age_days <= 30).reduce((s, r) => s + r.amount, 0),
    "31-60": transmittedUnpaid.filter((r) => r.age_days > 30 && r.age_days <= 60).reduce((s, r) => s + r.amount, 0),
    "61-90": transmittedUnpaid.filter((r) => r.age_days > 60 && r.age_days <= 90).reduce((s, r) => s + r.amount, 0),
    "90+": transmittedUnpaid.filter((r) => r.age_days > 90).reduce((s, r) => s + r.amount, 0),
  };

  // ── 9. Recommendation summary ──
  const recommendationSummary: Record<string, { count: number; amount: number }> = {};
  for (const r of rows) {
    const cat = r.action_category || "REVIEW";
    if (!recommendationSummary[cat]) recommendationSummary[cat] = { count: 0, amount: 0 };
    recommendationSummary[cat].count++;
    recommendationSummary[cat].amount += r.amount;
  }

  // ── 10. Filter by aging if requested ──
  let filteredRows = rows;
  if (agingMinDays > 0) {
    filteredRows = rows.filter((r) => r.age_days >= agingMinDays);
  }

  return NextResponse.json({
    rows: filteredRows,
    summary,
    agingBuckets,
    agingAmounts,
    recommendationSummary,
  });
}
