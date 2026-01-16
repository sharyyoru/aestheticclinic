import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    console.log('Templates API called');
    console.log('Service account email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('Private key exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // List files from the Templates folder
    const TEMPLATES_FOLDER_ID = '1XIzFLA07OEmk-T4z1zijj0FUEcNyIb4S';

    console.log('Fetching templates from folder:', TEMPLATES_FOLDER_ID);

    const response = await drive.files.list({
      q: `'${TEMPLATES_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id, name, mimeType, modifiedTime, description)',
      orderBy: 'name',
    });

    console.log('Templates found:', response.data.files?.length || 0);

    let templates = response.data.files || [];

    // Filter by search term if provided
    if (search) {
      templates = templates.filter(file => 
        file.name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Format templates for frontend
    const formattedTemplates = templates.map(file => ({
      id: file.id,
      name: file.name,
      description: file.description || '',
      file_path: file.id, // Use Google Drive file ID as path
      file_type: 'application/vnd.google-apps.document',
      category: 'Medical Template',
      storage_only: false,
    }));

    return NextResponse.json({ templates: formattedTemplates });
  } catch (error) {
    console.error("Error fetching templates from Google Drive:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
