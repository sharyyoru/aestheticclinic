import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const emailGalleryBucket = buckets?.find(b => b.id === "emailgallery");

    if (!emailGalleryBucket) {
      // Create the bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket("emailgallery", {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
      });

      if (createError) {
        return NextResponse.json({ error: createError.message, action: "create" }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: "Bucket created successfully",
        isPublic: true 
      });
    }

    // Bucket exists - check if it's public
    if (!emailGalleryBucket.public) {
      // Update bucket to be public
      const { error: updateError } = await supabaseAdmin.storage.updateBucket("emailgallery", {
        public: true,
      });

      if (updateError) {
        return NextResponse.json({ error: updateError.message, action: "update" }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: "Bucket updated to public",
        isPublic: true 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Bucket already exists and is public",
      isPublic: emailGalleryBucket.public 
    });

  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const emailGalleryBucket = buckets?.find(b => b.id === "emailgallery");

    return NextResponse.json({ 
      exists: !!emailGalleryBucket,
      bucket: emailGalleryBucket || null,
      allBuckets: buckets?.map(b => ({ id: b.id, public: b.public }))
    });

  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : "Unknown error" 
    }, { status: 500 });
  }
}
