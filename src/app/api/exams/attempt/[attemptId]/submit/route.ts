import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { getAttemptById, submitAttempt } from '@/lib/exams';

export async function POST(_req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(attemptId);
  const attempt = await getAttemptById(id);
  if (!attempt) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (Number(attempt.student_cid) !== Number(user.cid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const updated = await submitAttempt(id);
  return NextResponse.json({ ok: true, attempt: updated });
}
