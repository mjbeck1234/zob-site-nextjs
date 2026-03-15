import { NextResponse } from 'next/server';
import { getSplits } from '@/lib/content';

export async function GET() {
  const data = await getSplits();
  // Ensure JSON serializable (postgres BIGINT can come back as BigInt).
  const safe = Array.isArray(data)
    ? data.map((r: any) => ({
        ...r,
        id: typeof r?.id === 'bigint' ? r.id.toString() : r?.id,
      }))
    : data;

  return NextResponse.json({ data: safe });
}
