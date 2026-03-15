import { NextResponse } from 'next/server';
import { getZobControllersOnline } from '@/lib/vatsim';

export async function GET() {
  const data = await getZobControllersOnline();
  return NextResponse.json({ data });
}
