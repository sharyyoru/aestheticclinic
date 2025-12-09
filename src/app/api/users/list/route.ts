import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (error || !data?.users) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to list users" },
        { status: 500 },
      );
    }

    const users = data.users.map((user) => {
      const meta = (user.user_metadata || {}) as Record<string, unknown>;

      return {
        id: user.id,
        email: user.email ?? null,
        role: (meta["role"] as string) ?? null,
        firstName: (meta["first_name"] as string) ?? null,
        lastName: (meta["last_name"] as string) ?? null,
        fullName: (meta["full_name"] as string) ?? null,
        designation: (meta["designation"] as string) ?? null,
        createdAt: (user as any).created_at ?? null,
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error listing users" },
      { status: 500 },
    );
  }
}
