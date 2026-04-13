import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import fs from "fs";
import path from "path";

// GET: List available HTML templates from public/templates folder
export async function GET() {
  try {
    const templatesDir = path.join(process.cwd(), "public", "templates");
    
    if (!fs.existsSync(templatesDir)) {
      return NextResponse.json({ templates: [] });
    }

    const files = fs.readdirSync(templatesDir);
    const htmlFiles = files
      .filter((file) => file.endsWith(".html"))
      .map((file) => {
        const filePath = path.join(templatesDir, file);
        const stats = fs.statSync(filePath);
        // Extract name from filename (remove ID prefix and extension)
        const nameMatch = file.match(/^\d+_(.+)\.html$/);
        const displayName = nameMatch 
          ? nameMatch[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : file.replace(".html", "");
        
        return {
          filename: file,
          displayName,
          size: stats.size,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json({ templates: htmlFiles });
  } catch (error) {
    console.error("Error listing HTML templates:", error);
    return NextResponse.json(
      { error: "Failed to list templates" },
      { status: 500 }
    );
  }
}

// POST: Import selected HTML templates to database
export async function POST(request: NextRequest) {
  try {
    const { filenames } = await request.json();

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json(
        { error: "No filenames provided" },
        { status: 400 }
      );
    }

    const templatesDir = path.join(process.cwd(), "public", "templates");
    const imported: string[] = [];
    const errors: string[] = [];

    for (const filename of filenames) {
      try {
        const filePath = path.join(templatesDir, filename);
        
        // Security check: ensure the file is within the templates directory
        if (!filePath.startsWith(templatesDir)) {
          errors.push(`${filename}: Invalid path`);
          continue;
        }

        if (!fs.existsSync(filePath)) {
          errors.push(`${filename}: File not found`);
          continue;
        }

        const htmlContent = fs.readFileSync(filePath, "utf-8");
        
        // Extract name from filename
        const nameMatch = filename.match(/^\d+_(.+)\.html$/);
        const templateName = nameMatch
          ? nameMatch[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : filename.replace(".html", "");

        // Extract title from HTML if available
        const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
        const subjectTemplate = titleMatch ? titleMatch[1].trim() : templateName;

        // Insert into database
        const { error: insertError } = await supabaseAdmin
          .from("email_templates")
          .insert({
            name: templateName,
            type: "patient",
            subject_template: subjectTemplate,
            body_template: "",
            html_content: htmlContent,
          });

        if (insertError) {
          errors.push(`${filename}: ${insertError.message}`);
        } else {
          imported.push(filename);
        }
      } catch (err) {
        errors.push(`${filename}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      imported,
      errors,
      message: `Imported ${imported.length} template(s)${errors.length > 0 ? `, ${errors.length} failed` : ""}`,
    });
  } catch (error) {
    console.error("Error importing HTML templates:", error);
    return NextResponse.json(
      { error: "Failed to import templates" },
      { status: 500 }
    );
  }
}
