import { NextResponse } from 'next/server';

const WA_SERVER = process.env.WA_SERVER_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${WA_SERVER}/chats`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'WhatsApp server unavailable' }, { status: 503 });
  }
}
