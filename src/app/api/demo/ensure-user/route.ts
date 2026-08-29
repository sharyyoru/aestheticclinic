import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@aliice.com";
const DEMO_PASSWORD = "demotest";

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Create admin client with service role key
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Check if demo user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const demoUser = existingUsers?.users?.find(
      (u) => u.email === DEMO_EMAIL
    );

    let userId: string;

    if (demoUser) {
      userId = demoUser.id;
    } else {
      // Create the demo user in auth
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          email_confirm: true,
        });

      if (createError) {
        console.error("Error creating demo user:", createError);
        return NextResponse.json(
          { error: "Failed to create demo user" },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
    }

    // Ensure the user exists in the users table with is_demo = true
    const { error: upsertError } = await adminClient
      .from("users")
      .upsert(
        {
          id: userId,
          email: DEMO_EMAIL,
          full_name: "Demo User",
          role: "admin",
          is_demo: true,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      console.error("Error upserting demo user record:", upsertError);
      // Don't fail - auth user exists, just the users table entry failed
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error("Error ensuring demo user:", error);
    return NextResponse.json(
      { error: "Failed to ensure demo user" },
      { status: 500 }
    );
  }
}
