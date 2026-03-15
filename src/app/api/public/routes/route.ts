import { NextResponse } from 'next/server';
import { getRoutes } from '@/lib/content';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const arrival = searchParams.get('arrival') ?? undefined;
  const data = await getRoutes(arrival);
  return NextResponse.json({ data });
}
