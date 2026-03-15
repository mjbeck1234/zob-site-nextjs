'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireExamsManager, requireExamsGrader } from '@/lib/auth/guards';
import { sql } from '@/lib/db';
import { gradeAttempt, resetFailedAttempt, reviewCorrection } from '@/lib/exams';

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v : '';
}
function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : fallback;
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const rows: any[] = await sql`
    SELECT COUNT(*) AS c
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
  `;
  return Number(rows?.[0]?.c ?? 0) > 0;
}

/**
 * Schema notes:
 * - exams: id, title, passing_score, number_to_ask, reassign_period, created_at, updated_at (no description by default)
 * - exam_questions: id, exam_id, content, type, answer, d1, d2, d3, created_at, updated_at
 *   type: 0=MCQ, 1=True/False, 2=Written
 */

export async function createExamAction(formData: FormData) {
  await requireExamsManager();

  const title = str(formData.get('title')).trim();
  const description = str(formData.get('description')).trim();
  const passPercent = num(formData.get('pass_percent'), 80);
  const numberToAsk = num(formData.get('number_to_ask'), 0);
  const reassignPeriod = num(formData.get('reassign_period'), 0);

  if (!title) redirect('/admin/exams/new?error=missing');

  const hasDesc = await tableHasColumn('exams', 'description').catch(() => false);
  const cols: string[] = ['title', 'passing_score', 'number_to_ask', 'reassign_period'];
  const vals: any[] = [title, passPercent, numberToAsk, reassignPeriod];

  if (hasDesc) {
    cols.splice(1, 0, 'description'); // after title
    vals.splice(1, 0, description || null);
  }

  const q = `INSERT INTO exams (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING id`;
  const rows: any[] = await sql.unsafe(q, vals);
  const id = Number(rows?.[0]?.id ?? 0);

  revalidatePath('/admin/exams');
  redirect(`/admin/exams/${id}`);
}

export async function updateExamAction(examId: string, formData: FormData) {
  await requireExamsManager();
  const id = Number(examId);

  const title = str(formData.get('title')).trim();
  const description = str(formData.get('description')).trim();
  const passPercent = num(formData.get('pass_percent'), 80);
  const numberToAsk = num(formData.get('number_to_ask'), 0);
  const reassignPeriod = num(formData.get('reassign_period'), 0);

  const hasDesc = await tableHasColumn('exams', 'description').catch(() => false);

  // Build a safe dynamic UPDATE so we don't crash if description doesn't exist.
  const sets: string[] = [];
  const vals: any[] = [];

  sets.push('title = ?'); vals.push(title);
  sets.push('passing_score = ?'); vals.push(passPercent);
  sets.push('number_to_ask = ?'); vals.push(numberToAsk);
  sets.push('reassign_period = ?'); vals.push(reassignPeriod);

  if (hasDesc) { sets.push('description = ?'); vals.push(description || null); }

  // If timestamps exist, update updated_at
  const hasUpdated = await tableHasColumn('exams', 'updated_at').catch(() => false);
  if (hasUpdated) sets.push('updated_at = NOW()');

  vals.push(id);

  await sql.unsafe(`UPDATE exams SET ${sets.join(', ')} WHERE id = ?`, vals);

  revalidatePath(`/admin/exams/${id}`);
  redirect(`/admin/exams/${id}?saved=1`);
}

export async function deleteExamAction(examId: string) {
  await requireExamsManager();
  const id = Number(examId);
  await sql`DELETE FROM exams WHERE id = ${id}`;
  revalidatePath('/admin/exams');
  redirect('/admin/exams?deleted=1');
}

export async function createQuestionAction(examId: string, formData: FormData) {
  await requireExamsManager();
  const eid = Number(examId);

  const qtype = str(formData.get('qtype')).trim() || 'mcq';
  const prompt = str(formData.get('prompt')).trim();

  // Embedded MCQ fields (required as NOT NULL in DB)
  const answer = str(formData.get('answer')).trim();
  const d1 = str(formData.get('d1')).trim();
  const d2 = str(formData.get('d2')).trim();
  const d3 = str(formData.get('d3')).trim();

  if (!prompt) redirect(`/admin/exams/${eid}?error=missing_prompt`);

  const typeNum = qtype === 'written' ? 2 : qtype === 'tf' ? 1 : 0;

  // For TF/written, keep distractors non-null
  const safeAnswer = typeNum === 0 ? answer : (typeNum === 1 ? (answer.toLowerCase().startsWith('t') ? 'true' : 'false') : (answer || ''));
  const safeD1 = typeNum === 0 ? d1 : '';
  const safeD2 = typeNum === 0 ? d2 : '';
  const safeD3 = typeNum === 0 ? d3 : '';

  await sql`
    INSERT INTO exam_questions (exam_id, content, type, answer, d1, d2, d3, created_at, updated_at)
    VALUES (${eid}, ${prompt}, ${typeNum}, ${safeAnswer}, ${safeD1}, ${safeD2}, ${safeD3}, NOW(), NOW())
  `;

  revalidatePath(`/admin/exams/${eid}`);
  redirect(`/admin/exams/${eid}?q_added=1`);
}

export async function updateQuestionAction(examId: string, questionId: string, formData: FormData) {
  await requireExamsManager();
  const eid = Number(examId);
  const qid = Number(questionId);

  const qtype = str(formData.get('qtype')).trim() || 'mcq';
  const prompt = str(formData.get('prompt')).trim();

  const answer = str(formData.get('answer')).trim();
  const d1 = str(formData.get('d1')).trim();
  const d2 = str(formData.get('d2')).trim();
  const d3 = str(formData.get('d3')).trim();

  if (!prompt) redirect(`/admin/exams/${eid}?error=missing_prompt`);

  const typeNum = qtype === 'written' ? 2 : qtype === 'tf' ? 1 : 0;

  const safeAnswer = typeNum === 0 ? answer : (typeNum === 1 ? (answer.toLowerCase().startsWith('t') ? 'true' : 'false') : (answer || ''));
  const safeD1 = typeNum === 0 ? d1 : '';
  const safeD2 = typeNum === 0 ? d2 : '';
  const safeD3 = typeNum === 0 ? d3 : '';

  await sql`
    UPDATE exam_questions
    SET content = ${prompt},
        type = ${typeNum},
        answer = ${safeAnswer},
        d1 = ${safeD1},
        d2 = ${safeD2},
        d3 = ${safeD3},
        updated_at = NOW()
    WHERE id = ${qid} AND exam_id = ${eid}
  `;

  revalidatePath(`/admin/exams/${eid}`);
  redirect(`/admin/exams/${eid}?q_saved=1#q-${qid}`);
}

export async function deleteQuestionAction(examId: string, questionId: string) {
  await requireExamsManager();
  const eid = Number(examId);
  const qid = Number(questionId);
  await sql`DELETE FROM exam_questions WHERE id = ${qid} AND exam_id = ${eid}`;
  revalidatePath(`/admin/exams/${eid}`);
  redirect(`/admin/exams/${eid}?q_deleted=1`);
}

// The current DB does not use exam_choices; keep these exports as safe no-ops (so imports won't crash if any stray refs exist).
export async function createChoiceAction(examId: string) {
  await requireExamsManager();
  redirect(`/admin/exams/${Number(examId)}?error=choices_not_supported`);
}
export async function updateChoiceAction(examId: string) {
  await requireExamsManager();
  redirect(`/admin/exams/${Number(examId)}?error=choices_not_supported`);
}
export async function deleteChoiceAction(examId: string) {
  await requireExamsManager();
  redirect(`/admin/exams/${Number(examId)}?error=choices_not_supported`);
}

export async function resetAttemptFromExamEditorAction(examId: string, attemptId: string) {
  await requireExamsManager();
  const eid = Number(examId);
  const aid = Number(attemptId);

  await sql`
    UPDATE exam_attempts
    SET locked = 0,
        status = 'in_progress',
        updated_at = NOW()
    WHERE id = ${aid} AND exam_id = ${eid}
  `;

  // Clean out previous answers so the student can re-attempt cleanly
  await sql`
    DELETE ea FROM exam_answers ea
    INNER JOIN exam_attempts a ON a.id = ea.attempt_id
    WHERE a.id = ${aid} AND a.exam_id = ${eid}
  `;

  revalidatePath(`/admin/exams/${eid}`);
  redirect(`/admin/exams/${eid}?reset=1`);
}


export async function gradeAttemptAction(attemptId: string, formData: FormData) {
  const user = await requireExamsGrader();
  const attemptIdNum = Number(attemptId);
  if (!Number.isFinite(attemptIdNum)) redirect('/admin/exams/review?error=bad_attempt');

  const pointsByQuestionId: Record<string, number> = {};
  const commentByQuestionId: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('points_')) {
      const qid = key.slice('points_'.length);
      pointsByQuestionId[qid] = num(value as any, 0);
    } else if (key.startsWith('comment_')) {
      const qid = key.slice('comment_'.length);
      commentByQuestionId[qid] = typeof value === 'string' ? value : '';
    }
  }

  await gradeAttempt({
    attemptId: attemptIdNum,
    graderCid: Number((user as any).cid),
    pointsByQuestionId,
    commentByQuestionId,
  });

  revalidatePath('/admin/exams/review');
  revalidatePath(`/admin/exams/review/${attemptIdNum}`);
  redirect(`/admin/exams/review/${attemptIdNum}?graded=1`);
}

export async function resetAttemptAction(attemptId: string) {
  const user = await requireExamsGrader();
  const attemptIdNum = Number(attemptId);
  if (!Number.isFinite(attemptIdNum)) redirect('/admin/exams/review?error=bad_attempt');

  // resetFailedAttempt is defined as (attemptId: number, resetByCid: number)
  await resetFailedAttempt(attemptIdNum, Number((user as any).cid));

  revalidatePath('/admin/exams/review');
  revalidatePath(`/admin/exams/review/${attemptIdNum}`);
  redirect(`/admin/exams/review/${attemptIdNum}?reset=1`);
}

export async function reviewCorrectionAction(correctionId: string, formData: FormData) {
  const user = await requireExamsGrader();

  const id = Number(correctionId);
  if (!Number.isFinite(id) || id <= 0) redirect('/admin/exams/corrections?error=bad_id');

  const decisionRaw = str(formData.get('decision')).toLowerCase();
  const status = decisionRaw === 'approved' ? 'approved' : 'rejected';
  const pointsAwarded = formData.get('points_awarded');
  const points = pointsAwarded == null ? null : num(pointsAwarded as any, 0);
  const reviewerComment = (str(formData.get('mentor_note')) || str(formData.get('reviewer_comment'))).trim() || null;

  await reviewCorrection({
    correctionId: id,
    reviewedByCid: Number((user as any).cid),
    status: status as any,
    pointsAwarded: points,
    reviewerComment,
  });

  revalidatePath('/admin/exams/corrections');
  revalidatePath(`/admin/exams/corrections/${id}`);
  redirect(`/admin/exams/corrections/${id}?reviewed=1`);
}
