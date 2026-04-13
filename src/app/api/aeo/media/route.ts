import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NAME = "aeo-media";

// GET - List all media files
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "";
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const { data: files, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(folder, {
        limit,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      // Bucket might not exist yet
      if (error.message.includes("not found")) {
        return NextResponse.json({ 
          success: true, 
          files: [],
          message: "Media bucket not created yet. Upload a file to create it."
        });
      }
      throw error;
    }

    // Generate signed URLs for each file
    const filesWithUrls = await Promise.all(
      (files || [])
        .filter(f => f.name && !f.name.startsWith("."))
        .map(async (file) => {
          const path = folder ? `${folder}/${file.name}` : file.name;
          const { data: urlData } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .createSignedUrl(path, 3600); // 1 hour expiry

          return {
            name: file.name,
            path,
            size: file.metadata?.size || 0,
            type: file.metadata?.mimetype || "unknown",
            createdAt: file.created_at,
            url: urlData?.signedUrl || null,
          };
        })
    );

    return NextResponse.json({ success: true, files: filesWithUrls });
  } catch (error) {
    console.error("Error listing media:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list media" },
      { status: 500 }
    );
  }
}

// POST - Upload media file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "general";
    const tags = (formData.get("tags") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images are allowed." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").toLowerCase();
    const filename = `${timestamp}-${safeName}`;
    const path = `${folder}/${filename}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message.includes("not found")) {
        // Create the bucket
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 10485760, // 10MB
        });

        // Retry upload
        const { data: retryData, error: retryError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(path, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }

    // Generate signed URL
    const { data: urlData } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 86400 * 7); // 7 days

    // Also get public URL for articles
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      file: {
        name: filename,
        path,
        size: file.size,
        type: file.type,
        url: urlData?.signedUrl || publicUrlData.publicUrl,
        publicUrl: publicUrlData.publicUrl,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("Error uploading media:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload media" },
      { status: 500 }
    );
  }
}

// DELETE - Delete media file
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete media" },
      { status: 500 }
    );
  }
}
