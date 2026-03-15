import { NextResponse } from 'next/server';
import { getStaff } from '@/lib/content';

export async function GET() {
  const data = await getStaff();
  return NextResponse.json({ data });
}
