import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
  try {
    // Check environment variables
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!serviceAccountEmail || !privateKey) {
      return NextResponse.json(
        { error: "Google service account credentials not configured" },
        { status: 500 }
      );
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // List all files in service account's Drive
    console.log('Listing all files in service account Drive...');
    const listResponse = await drive.files.list({
      pageSize: 1000,
      fields: 'files(id, name, size, createdTime)',
    });

    const files = listResponse.data.files || [];
    console.log(`Found ${files.length} files`);

    if (files.length === 0) {
      return NextResponse.json({
        message: 'No files found in service account Drive',
        deletedCount: 0,
      });
    }

    // Delete all files
    let deletedCount = 0;
    let errors = [];

    for (const file of files) {
      try {
        await drive.files.delete({ fileId: file.id! });
        deletedCount++;
        console.log(`Deleted: ${file.name} (${file.id})`);
      } catch (deleteError) {
        console.error(`Failed to delete ${file.name}:`, deleteError);
        errors.push({ file: file.name, error: deleteError instanceof Error ? deleteError.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      message: `Cleanup complete. Deleted ${deletedCount} of ${files.length} files`,
      deletedCount,
      totalFiles: files.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return NextResponse.json(
      { error: "Failed to cleanup Drive", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
