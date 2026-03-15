import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { getAttemptById, upsertAnswer } from '@/lib/exams';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(attemptId);
  const attempt = await getAttemptById(id);
  if (!attempt) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (Number(attempt.student_cid) !== Number(user.cid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (String(attempt.status) !== 'in_progress') return NextResponse.json({ error: 'not_editable' }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const questionId = Number(body?.questionId);
  if (!questionId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // Ensure question belongs to the exam
  const qOk = await tableExists('exam_questions').catch(() => false);
  if (qOk) {
    const rows = await sql<any[]>`
      SELECT id FROM exam_questions WHERE id = ${questionId} AND exam_id = ${attempt.exam_id} LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ error: 'bad_question' }, { status: 400 });
  }

  const obj = body && typeof body === 'object' ? (body as any) : {};
  const hasSel = Object.prototype.hasOwnProperty.call(obj, 'selected_choice_id');
  const hasWt = Object.prototype.hasOwnProperty.call(obj, 'written_text');

  const selectedChoiceId = hasSel ? (obj.selected_choice_id != null ? Number(obj.selected_choice_id) : null) : undefined;
  const writtenText = hasWt ? (typeof obj.written_text === 'string' ? obj.written_text : null) : undefined;

  try {
    await upsertAnswer({
      attemptId: id,
      questionId,
      selectedChoiceId,
      writtenText,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const msg = err?.message || 'Failed to save answer';
    return new NextResponse(msg, { status: 500 });
  }
}
