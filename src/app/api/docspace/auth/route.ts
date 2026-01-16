import { NextResponse } from "next/server";

const DOCSPACE_URL = process.env.NEXT_PUBLIC_DOCSPACE_URL || "https://docspace-hm9cxt.onlyoffice.com";
const DOCSPACE_EMAIL = process.env.DOCSPACE_EMAIL;
const DOCSPACE_PASSWORD = process.env.DOCSPACE_PASSWORD;

export async function POST() {
  try {
    if (!DOCSPACE_EMAIL || !DOCSPACE_PASSWORD) {
      return NextResponse.json(
        { error: "DocSpace credentials not configured. Please set DOCSPACE_EMAIL and DOCSPACE_PASSWORD in environment variables." },
        { status: 500 }
      );
    }

    // Authenticate with DocSpace API
    const response = await fetch(DOCSPACE_URL + "/api/2.0/authentication", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userName: DOCSPACE_EMAIL,
        password: DOCSPACE_PASSWORD,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DocSpace authentication failed:", errorText);
      return NextResponse.json(
        { error: "Failed to authenticate with DocSpace" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      token: data.response?.token,
      expires: data.response?.expires,
    });
  } catch (error) {
    console.error("Error authenticating with DocSpace:", error);
    return NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 }
    );
  }
}
