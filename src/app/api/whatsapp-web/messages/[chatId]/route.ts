import { NextResponse } from 'next/server';

const WA_SERVER = process.env.WA_SERVER_URL || 'http://localhost:3001';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '50';
    const res = await fetch(`${WA_SERVER}/messages/${encodeURIComponent(chatId)}?limit=${limit}`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'WhatsApp server unavailable' }, { status: 503 });
  }
}
