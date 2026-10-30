import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PATIENT_SELECT_FORBIDDEN = new Set(["id", "created_at"]);
const CHILD_TABLES = new Set([
  "patient_insurances",
  "patient_health_background",
  "patient_intake_preferences",
]);

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const PHOTO_BUCKET = "patient-photos";

// Photos are written to <patient-uuid>/<category>/<position>_<ts>.<ext>. The
// extension is optional because some Android galleries and share sheets hand
// over a file with no extension at all, which used to be rejected outright.
const PHOTO_PATH_RE =
  /^[0-9a-fA-F-]{36}\/[a-z_]+\/[a-z_]+_\d+(\.[a-zA-Z0-9]{1,8})?$/;

function photoPathError(fileName: string): string | null {
  if (!fileName || fileName.includes("..")) return "file_name required";
  if (!PHOTO_PATH_RE.test(fileName)) return "invalid file_name";
  return null;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      if (form.get("action") !== "upload_photo") return err("Unknown action", 404);
      const file = form.get("file");
      const fileName = String(form.get("file_name") || "");
      if (!(file instanceof File)) return err("file and file_name required");
      const pathError = photoPathError(fileName);
      if (pathError) return err(pathError);
      // Retained for clients that still post the file itself. Anything over
      // ~4.5 MB never reaches this handler — Vercel rejects the request first
      // — so the client is expected to use the signed-URL action below.
      const { error } = await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .upload(fileName, file, { contentType: file.type || undefined });
      if (error) return err(error.message, 500);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return err(e instanceof Error ? e.message : "Upload failed", 500);
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON");
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    switch (action) {
      // Hands back a one-shot signed upload URL so the browser can send the
      // photo straight to Supabase Storage. Posting the file through this
      // route instead capped uploads at Vercel's 4.5 MB request limit, which
      // rejected most phone photos (verified: 4 MB passed, 4.5 MB returned
      // FUNCTION_PAYLOAD_TOO_LARGE). The path is still authorised here, so
      // anon gains no broader storage access.
      case "photo_upload_url": {
        const fileName = String(body.file_name || "");
        const pathError = photoPathError(fileName);
        if (pathError) return err(pathError);
        const { data, error } = await supabaseAdmin.storage
          .from(PHOTO_BUCKET)
          .createSignedUploadUrl(fileName);
        if (error || !data) return err(error?.message || "Could not sign upload", 500);
        return NextResponse.json({
          url: data.signedUrl,
          token: data.token,
          path: data.path,
        });
      }

      case "lookup_patient": {
        const email = String(body.email || "").trim();
        if (!email) return err("email required");
        const { data, error } = await supabaseAdmin
          .from("patients")
          .select("id, first_name, last_name, email")
          .ilike("email", email)
          .maybeSingle();
        if (error) return err(error.message, 500);
        return NextResponse.json({ patient: data });
      }

      case "lookup_patient_by_phone": {
        const phoneKey = String(body.phone_key || "").replace(/\D/g, "");
        if (phoneKey.length !== 9) return err("phone_key must be 9 digits");
        const { data, error } = await supabaseAdmin
          .from("patients")
          .select("id, phone")
          .not("phone", "is", null)
          .ilike("phone", `%${phoneKey}%`);
        if (error) return err(error.message, 500);
        return NextResponse.json({ candidates: data || [] });
      }

      case "create_patient": {
        const data = (body.data || {}) as Record<string, unknown>;
        const { data: row, error } = await supabaseAdmin
          .from("patients")
          .insert(data)
          .select("id")
          .single();
        if (error) return err(error.message, 500);
        return NextResponse.json({ id: row.id });
      }

      case "get_patient": {
        const id = String(body.id || "");
        if (!id) return err("id required");
        const { data, error } = await supabaseAdmin
          .from("patients")
          .select("*")
          .eq("id", id)
          .single();
        if (error) return err(error.message, error.code === "PGRST116" ? 404 : 500);
        return NextResponse.json({ patient: data });
      }

      case "get_patient_contact": {
        const id = String(body.id || "");
        if (!id) return err("id required");
        const { data, error } = await supabaseAdmin
          .from("patients")
          .select("first_name, last_name, email, phone, dob, street_address, postal_code, town")
          .eq("id", id)
          .single();
        if (error) return err(error.message, error.code === "PGRST116" ? 404 : 500);
        return NextResponse.json({ patient: data });
      }

      case "update_patient": {
        const id = String(body.id || "");
        const data = { ...((body.data || {}) as Record<string, unknown>) };
        if (!id) return err("id required");
        for (const col of PATIENT_SELECT_FORBIDDEN) delete data[col];
        const { error } = await supabaseAdmin.from("patients").update(data).eq("id", id);
        if (error) return err(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "create_submission": {
        const data = (body.data || {}) as Record<string, unknown>;
        const { data: row, error } = await supabaseAdmin
          .from("patient_intake_submissions")
          .insert(data)
          .select("id")
          .single();
        if (error) return err(error.message, 500);
        return NextResponse.json({ id: row.id });
      }

      case "update_submission": {
        const id = String(body.id || "");
        const data = (body.data || {}) as Record<string, unknown>;
        if (!id) return err("id required");
        const { error } = await supabaseAdmin
          .from("patient_intake_submissions")
          .update(data)
          .eq("id", id);
        if (error) return err(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "get_record": {
        const table = String(body.table || "");
        if (!CHILD_TABLES.has(table)) return err("table not allowed");
        const field = body.submission_id ? "submission_id" : "patient_id";
        const value = String(body.submission_id || body.patient_id || "");
        if (!value) return err("patient_id or submission_id required");
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("*")
          .eq(field, value)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) return err(error.message, 500);
        return NextResponse.json({ record: data });
      }

      case "get_records": {
        const table = String(body.table || "");
        if (!CHILD_TABLES.has(table)) return err("table not allowed");
        const patientId = String(body.patient_id || "");
        if (!patientId) return err("patient_id required");
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("*")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false });
        if (error) return err(error.message, 500);
        return NextResponse.json({ records: data || [] });
      }

      case "upsert_record": {
        const table = String(body.table || "");
        if (!CHILD_TABLES.has(table)) return err("table not allowed");
        const id = body.id ? String(body.id) : "";
        const data = (body.data || {}) as Record<string, unknown>;
        if (id) {
          const { error } = await supabaseAdmin.from(table).update(data).eq("id", id);
          if (error) return err(error.message, 500);
        } else {
          const { error } = await supabaseAdmin.from(table).insert(data);
          if (error) return err(error.message, 500);
        }
        return NextResponse.json({ ok: true });
      }

      case "upsert_consultation_data": {
        const data = (body.data || {}) as Record<string, unknown>;
        const { error } = await supabaseAdmin
          .from("patient_consultation_data")
          .upsert(data, { onConflict: "patient_id,consultation_type" });
        if (error) return err(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      default:
        return err("Unknown action", 404);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : "Internal error", 500);
  }
}
