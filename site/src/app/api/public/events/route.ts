import { NextResponse } from 'next/server';
import { getUpcomingEvents } from '@/lib/content';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '6');
  const data = await getUpcomingEvents(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 6);
  return NextResponse.json({ data });
}
