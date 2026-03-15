import { NextResponse } from 'next/server';
import { getRoster } from '@/lib/content';

export async function GET() {
  const data = await getRoster();
  return NextResponse.json({ data });
}
