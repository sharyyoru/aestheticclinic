import { NextResponse } from "next/server";

const DOCSPACE_URL = process.env.NEXT_PUBLIC_DOCSPACE_URL || "https://docspace-hm9cxt.onlyoffice.com";
const DOCSPACE_EMAIL = process.env.DOCSPACE_EMAIL;
const DOCSPACE_PASSWORD = process.env.DOCSPACE_PASSWORD;

export async function POST() {
  try {
    if (!DOCSPACE_EMAIL || !DOCSPACE_PASSWORD) {
      return NextResponse.json(
        { 
          success: false,
          error: "DocSpace credentials not configured. Please set DOCSPACE_EMAIL and DOCSPACE_PASSWORD in environment variables." 
        },
        { status: 500 }
      );
    }

    // Get hash settings from DocSpace
    const hashSettingsResponse = await fetch(DOCSPACE_URL + "/api/2.0/settings/security/password", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!hashSettingsResponse.ok) {
      console.error("Failed to get hash settings");
      return NextResponse.json(
        { success: false, error: "Failed to get hash settings from DocSpace" },
        { status: hashSettingsResponse.status }
      );
    }

    const hashSettings = await hashSettingsResponse.json();
    
    // Create password hash using DocSpace's hash settings
    const crypto = require("crypto");
    const salt = hashSettings.response?.salt || "";
    const iterations = hashSettings.response?.iterations || 100000;
    const hashSize = hashSettings.response?.size || 256;
    
    const passwordHash = crypto.pbkdf2Sync(
      DOCSPACE_PASSWORD,
      salt,
      iterations,
      hashSize / 8,
      "sha256"
    ).toString("base64");

    return NextResponse.json({
      success: true,
      email: DOCSPACE_EMAIL,
      passwordHash: passwordHash,
    });
  } catch (error) {
    console.error("Error preparing login credentials:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during login preparation" },
      { status: 500 }
    );
  }
}
