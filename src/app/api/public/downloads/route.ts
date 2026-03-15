import { NextResponse } from 'next/server';
import { getDownloadsByCategory } from '@/lib/content';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? undefined;
  const data = await getDownloadsByCategory(category ?? undefined);
  return NextResponse.json({ data });
}
