import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { createCorrectionRequest, getAttemptById } from '@/lib/exams';

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(attemptId);
  const attempt = await getAttemptById(id);
  if (!attempt) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (Number(attempt.student_cid) !== Number(user.cid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const questionId = Number(body?.questionId);
  const proposedChoiceId = body?.proposed_choice_id !== undefined && body?.proposed_choice_id !== null ? Number(body.proposed_choice_id) : null;
  const proposedText = typeof body?.proposed_text === 'string' ? body.proposed_text : null;
  const reasoning = typeof body?.reasoning === 'string' ? body.reasoning : '';
  const proofUrl = typeof body?.proof_url === 'string' ? body.proof_url : null;
  const proofText = typeof body?.proof_text === 'string' ? body.proof_text : null;

  if (!questionId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    const correction = await createCorrectionRequest({
      attemptId: id,
      questionId,
      requestedByCid: Number(user.cid),
      proposedChoiceId,
      proposedText,
      reasoning,
      reason: reasoning,
      proofUrl,
      proofText,
    });

    return NextResponse.json({ ok: true, correction });
  } catch (e: any) {
    const msg = String(e?.message ?? 'error');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
