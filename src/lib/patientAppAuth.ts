import crypto from "crypto";

/**
 * Patient App authentication helpers.
 * Stateless email OTP + signed session tokens (no extra DB tables needed).
 */

const SECRET =
  process.env.PATIENT_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const OTP_WINDOW_MS = 5 * 60 * 1000; // 5 minute windows
const OTP_VALID_WINDOWS = 3; // current + 2 previous => valid 10-15 min
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hmac(input: string): string {
  return crypto.createHmac("sha256", SECRET).update(input).digest("hex");
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

/** Generate the 6-digit OTP for an email for a given time window offset. */
function otpForWindow(email: string, windowOffset: number): string {
  const window = Math.floor(Date.now() / OTP_WINDOW_MS) - windowOffset;
  const digest = hmac(`patientapp-otp:${email.trim().toLowerCase()}:${window}`);
  const num = parseInt(digest.slice(0, 12), 16) % 1000000;
  return String(num).padStart(6, "0");
}

export function generateOtp(email: string): string {
  return otpForWindow(email, 0);
}

export function verifyOtp(email: string, code: string): boolean {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  for (let offset = 0; offset < OTP_VALID_WINDOWS; offset++) {
    const expected = otpForWindow(email, offset);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) {
      return true;
    }
  }
  return false;
}

export type PatientSession = {
  patientId: string;
  email: string;
  exp: number;
};

export function createSessionToken(patientId: string, email: string): string {
  const payload: PatientSession = {
    patientId,
    email: email.trim().toLowerCase(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = b64urlEncode(JSON.stringify(payload));
  const signature = hmac(`patientapp-token:${encoded}`);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | null | undefined): PatientSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = hmac(`patientapp-token:${encoded}`);
  try {
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      return null;
    }
    const payload = JSON.parse(b64urlDecode(encoded)) as PatientSession;
    if (!payload.patientId || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Extract and verify the patient session from a request's Authorization header. */
export function getPatientSession(request: Request): PatientSession | null {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return verifySessionToken(token);
}
