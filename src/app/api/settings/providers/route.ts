import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProviderRole = "billing_entity" | "doctor" | "nurse" | "technician";

type ProviderPayload = {
  id?: string;
  name?: string | null;
  role?: ProviderRole;
  specialty?: string | null;
  email?: string | null;
  phone?: string | null;
  gln?: string | null;
  zsr?: string | null;
  salutation?: string | null;
  title?: string | null;
  street?: string | null;
  street_no?: string | null;
  zip_code?: string | null;
  city?: string | null;
  canton?: string | null;
  vatuid?: string | null;
  iban?: string | null;
  linked_user_id?: string | null;
};

const ALLOWED_ROLES: ProviderRole[] = [
  "billing_entity",
  "doctor",
  "nurse",
  "technician",
];

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function syncProviderLink(providerId: string, linkedUserId: string | null) {
  const { error: clearExistingLinkError } = await supabaseAdmin
    .from("users")
    .update({ provider_id: null })
    .eq("provider_id", providerId);

  if (clearExistingLinkError) {
    throw new Error(clearExistingLinkError.message);
  }

  if (linkedUserId) {
    const { error: clearUserExistingProviderError } = await supabaseAdmin
      .from("users")
      .update({ provider_id: null })
      .eq("id", linkedUserId)
      .neq("provider_id", providerId);

    if (clearUserExistingProviderError) {
      throw new Error(clearUserExistingProviderError.message);
    }

    const { error: setLinkError } = await supabaseAdmin
      .from("users")
      .update({ provider_id: providerId })
      .eq("id", linkedUserId);

    if (setLinkError) {
      throw new Error(setLinkError.message);
    }
  }
}

export async function GET() {
  try {
    const [{ data: providers, error: providersError }, { data: users, error: usersError }] = await Promise.all([
      supabaseAdmin
        .from("providers")
        .select("id, name, role, specialty, email, phone, gln, zsr, salutation, title, street, street_no, zip_code, city, canton, vatuid, iban, created_at")
        .order("role", { ascending: true })
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("users")
        .select("id, email, full_name, role, designation, provider_id"),
    ]);

    if (providersError) {
      return NextResponse.json({ error: providersError.message }, { status: 500 });
    }

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const linkedUsersByProviderId = new Map<string, (typeof users)[number]>();
    for (const user of users || []) {
      if (user.provider_id) {
        linkedUsersByProviderId.set(user.provider_id, user);
      }
    }

    const result = (providers || []).map((provider) => ({
      ...provider,
      linked_user: linkedUsersByProviderId.get(provider.id)
        ? {
            id: linkedUsersByProviderId.get(provider.id)?.id ?? null,
            email: linkedUsersByProviderId.get(provider.id)?.email ?? null,
            full_name: linkedUsersByProviderId.get(provider.id)?.full_name ?? null,
            role: linkedUsersByProviderId.get(provider.id)?.role ?? null,
            designation: linkedUsersByProviderId.get(provider.id)?.designation ?? null,
          }
        : null,
    }));

    return NextResponse.json({ providers: result });
  } catch (error) {
    console.error("GET settings/providers error:", error);
    return NextResponse.json(
      { error: "Failed to load providers" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProviderPayload;
    const role = body.role;

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
    }

    const name = normalizeOptional(body.name);
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const payload = {
      name,
      role,
      specialty: normalizeOptional(body.specialty),
      email: normalizeOptional(body.email),
      phone: normalizeOptional(body.phone),
      gln: normalizeOptional(body.gln),
      zsr: normalizeOptional(body.zsr),
      salutation: normalizeOptional(body.salutation),
      title: normalizeOptional(body.title),
      street: normalizeOptional(body.street),
      street_no: normalizeOptional(body.street_no),
      zip_code: normalizeOptional(body.zip_code),
      city: normalizeOptional(body.city),
      canton: normalizeOptional(body.canton),
      vatuid: normalizeOptional(body.vatuid),
      iban: normalizeOptional(body.iban),
    };

    if ((role === "billing_entity" || role === "doctor") && !payload.gln) {
      return NextResponse.json(
        { error: "GLN is required for billing entities and doctors" },
        { status: 400 },
      );
    }

    if (role === "billing_entity" && !payload.iban) {
      return NextResponse.json(
        { error: "IBAN is required for billing entities" },
        { status: 400 },
      );
    }

    const operation = body.id
      ? supabaseAdmin
          .from("providers")
          .update(payload)
          .eq("id", body.id)
          .select("id, name, role, specialty, email, phone, gln, zsr, salutation, title, street, street_no, zip_code, city, canton, vatuid, iban, created_at")
          .single()
      : supabaseAdmin
          .from("providers")
          .insert(payload)
          .select("id, name, role, specialty, email, phone, gln, zsr, salutation, title, street, street_no, zip_code, city, canton, vatuid, iban, created_at")
          .single();

    const { data: provider, error } = await operation;

    if (error || !provider) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save provider" },
        { status: 500 },
      );
    }

    await syncProviderLink(provider.id, normalizeOptional(body.linked_user_id));

    const { data: linkedUser } = await supabaseAdmin
      .from("users")
      .select("id, email, full_name, role, designation")
      .eq("provider_id", provider.id)
      .maybeSingle();

    return NextResponse.json({
      provider: {
        ...provider,
        linked_user: linkedUser || null,
      },
    });
  } catch (error) {
    console.error("POST settings/providers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save provider" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error: unlinkError } = await supabaseAdmin
      .from("users")
      .update({ provider_id: null })
      .eq("provider_id", id);

    if (unlinkError) {
      return NextResponse.json({ error: unlinkError.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin
      .from("providers")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE settings/providers error:", error);
    return NextResponse.json(
      { error: "Failed to delete provider" },
      { status: 500 },
    );
  }
}
