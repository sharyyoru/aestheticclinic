import { NextResponse } from 'next/server';
import { createWhatsAppAuthHeader } from '@/lib/whatsapp-auth';

const WA_SERVER = process.env.WA_SERVER_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  const authHeader = createWhatsAppAuthHeader(request);
  
  if (!authHeader) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  const res = await fetch(`${WA_SERVER}/connect`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Authorization': authHeader }
  });
  
  return NextResponse.json({ success: true });
}
