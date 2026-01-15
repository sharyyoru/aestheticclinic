import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabaseClient";

// GET - List patient documents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    if (!patientId) {
      return NextResponse.json(
        { error: "Patient ID is required" },
        { status: 400 }
      );
    }

    let query = supabaseClient
      .from("patient_documents")
      .select(`
        *,
        template:document_templates(id, name, category)
      `)
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false });

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching patient documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents: data || [] });
  } catch (error) {
    console.error("Error in patient documents API:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST - Create new patient document from template or blank
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, templateId, title, content } = body;

    if (!patientId || !title) {
      return NextResponse.json(
        { error: "Patient ID and title are required" },
        { status: 400 }
      );
    }

    const { data: authData } = await supabaseClient.auth.getUser();
    const { data: userData } = await supabaseClient
      .from("users")
      .select("full_name")
      .eq("id", authData?.user?.id)
      .single();

    // If template is provided, fetch template content
    let initialContent = content || "";
    if (templateId && !content) {
      // Get template file from storage and convert to HTML
      const { data: template } = await supabaseClient
        .from("document_templates")
        .select("file_path")
        .eq("id", templateId)
        .single();

      if (template?.file_path) {
        // Get signed URL for the template
        const { data: signedUrl } = await supabaseClient
          .storage
          .from("templates")
          .createSignedUrl(template.file_path, 60);

        if (signedUrl?.signedUrl) {
          // For now, set a placeholder - the editor will load the template
          initialContent = `<p>Loading template: ${template.file_path}...</p>`;
        }
      }
    }

    const { data, error } = await supabaseClient
      .from("patient_documents")
      .insert({
        patient_id: patientId,
        template_id: templateId || null,
        title,
        content: initialContent,
        status: "draft",
        version: 1,
        created_by: authData?.user?.id,
        created_by_name: userData?.full_name || "Unknown",
        last_edited_by: authData?.user?.id,
        last_edited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating patient document:", error);
      return NextResponse.json(
        { error: "Failed to create document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    console.error("Error in patient documents POST:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}

// PUT - Update patient document (auto-save)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, content, title, status } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const { data: authData } = await supabaseClient.auth.getUser();
    const { data: userData } = await supabaseClient
      .from("users")
      .select("full_name")
      .eq("id", authData?.user?.id)
      .single();

    // Get current document for version tracking
    const { data: currentDoc } = await supabaseClient
      .from("patient_documents")
      .select("version, content")
      .eq("id", documentId)
      .single();

    const updateData: Record<string, any> = {
      last_edited_by: authData?.user?.id,
      last_edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) {
      updateData.content = content;
    }

    if (title) {
      updateData.title = title;
    }

    if (status) {
      updateData.status = status;
      // If finalizing, increment version and save history
      if (status === "final" && currentDoc) {
        updateData.version = (currentDoc.version || 1) + 1;
        
        // Save version history
        await supabaseClient.from("patient_document_versions").insert({
          document_id: documentId,
          version: currentDoc.version || 1,
          content: currentDoc.content,
          changed_by: authData?.user?.id,
          changed_by_name: userData?.full_name || "Unknown",
        });
      }
    }

    const { data, error } = await supabaseClient
      .from("patient_documents")
      .update(updateData)
      .eq("id", documentId)
      .select()
      .single();

    if (error) {
      console.error("Error updating patient document:", error);
      return NextResponse.json(
        { error: "Failed to update document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    console.error("Error in patient documents PUT:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// DELETE - Delete patient document
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseClient
      .from("patient_documents")
      .delete()
      .eq("id", documentId);

    if (error) {
      console.error("Error deleting patient document:", error);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in patient documents DELETE:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
