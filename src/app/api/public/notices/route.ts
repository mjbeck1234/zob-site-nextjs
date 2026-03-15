import { NextResponse } from 'next/server';
import { getNotices } from '@/lib/content';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '5');
  const data = await getNotices(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 5);
  return NextResponse.json({ data });
}
