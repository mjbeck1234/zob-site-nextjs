import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: false,
    disabled: true,
    message: 'controller-hours cron is disabled in the current schema. Use the existing stats table instead.',
  }, { status: 410 });
}
