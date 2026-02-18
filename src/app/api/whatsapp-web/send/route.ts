import { NextResponse } from 'next/server';

const WA_SERVER = process.env.WA_SERVER_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${WA_SERVER}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'WhatsApp server unavailable' }, { status: 503 });
  }
}
