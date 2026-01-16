import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    // List files from Supabase 'templates' bucket
    const { data: files, error } = await supabaseAdmin.storage
      .from('templates')
      .list('', {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      console.error("Error fetching templates from Supabase:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    let templates = files || [];

    // Filter out folders (folders have id property) and keep only docx files
    templates = templates.filter(file => 
      file.name && file.name.toLowerCase().endsWith('.docx')
    );

    // Filter by search term if provided
    if (search) {
      templates = templates.filter(file => 
        file.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Format templates for frontend
    const formattedTemplates = templates.map(file => ({
      id: file.name, // Use filename as ID
      name: file.name.replace('.docx', ''), // Remove extension for display
      description: '',
      file_path: file.name,
      file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      category: 'Medical Template',
      storage_only: false,
    }));

    return NextResponse.json({ templates: formattedTemplates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
