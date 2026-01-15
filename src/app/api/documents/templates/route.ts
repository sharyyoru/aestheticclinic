import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key for storage access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - List all templates from storage bucket and database
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

    // First, list files from the templates bucket using admin client
    const { data: storageFiles, error: storageError } = await supabaseAdmin
      .storage
      .from("templates")
      .list("", {
        limit: 200,
        sortBy: { column: "name", order: "asc" },
      });

    if (storageError) {
      console.error("Error fetching templates from storage:", storageError);
    }

    console.log("Storage files found:", storageFiles?.length || 0);

    // Get templates from database
    let query = supabaseAdmin
      .from("document_templates")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const { data: dbTemplates, error: dbError } = await query;

    // Combine storage files with database records
    const templates = [];

    // Add storage files that might not be in DB yet
    if (storageFiles) {
      for (const file of storageFiles) {
        if (file.name && !file.name.startsWith(".")) {
          const existingInDb = dbTemplates?.find(t => t.file_path === file.name);
          
          // Apply search filter
          if (search && !file.name.toLowerCase().includes(search.toLowerCase())) {
            continue;
          }

          if (existingInDb) {
            templates.push({
              ...existingInDb,
              storage_metadata: file.metadata,
              size: file.metadata?.size,
            });
          } else {
            // Create a virtual template from storage file
            templates.push({
              id: `storage-${file.id}`,
              name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
              file_path: file.name,
              file_type: file.name.split(".").pop() || "docx",
              category: null,
              is_active: true,
              created_at: file.created_at,
              storage_only: true,
              size: file.metadata?.size,
            });
          }
        }
      }
    }

    // Add any DB templates not in storage list
    if (dbTemplates) {
      for (const dbTemplate of dbTemplates) {
        if (!templates.find(t => t.file_path === dbTemplate.file_path)) {
          templates.push(dbTemplate);
        }
      }
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error in templates API:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST - Sync a storage file to database or create new template record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, file_path, file_type, category } = body;

    const { data: authData } = await supabaseAdmin.auth.getUser();

    const { data, error } = await supabaseAdmin
      .from("document_templates")
      .upsert({
        name,
        description,
        file_path,
        file_type: file_type || "docx",
        category,
        is_active: true,
        created_by: authData?.user?.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "file_path",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating template:", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    console.error("Error in templates POST:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
