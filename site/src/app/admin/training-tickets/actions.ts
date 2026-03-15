'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteById, getById, insertDynamic, updateDynamic } from '@/lib/admin/crud';
import { normalizeBool, normalizeDate, normalizeInt, normalizeText } from '@/lib/admin/crud';
import { requireTrainingTicketWriter } from '@/lib/auth/guards';
import { requireSiteAdminOnly } from '@/lib/auth/admin';
import { canEditTrainingTicket, canViewAllTrainingTickets } from '@/lib/auth/trainingTickets';
import { getTrainingTicketsSchemaInfo } from '@/lib/trainingTickets';
import { TRAINING_RUBRIC, normalizeRubricRating } from '@/lib/trainingRubric';

function parseRubric(formData: FormData) {
  const ratings: Record<string, string> = {};
  const checks: Record<string, string[]> = {};

  for (const c of TRAINING_RUBRIC) {
    ratings[c.key] = normalizeRubricRating(formData.get(`rating_${c.key}`));
    checks[c.key] = formData
      .getAll(`check_${c.key}`)
      .map((v) => String(v))
      .filter(Boolean);
  }

  return { ratings, checks };
}

export async function createTrainingTicketAction(formData: FormData) {
  const actor = await requireTrainingTicketWriter();
  const viewAll = canViewAllTrainingTickets(actor);

  const schema = await getTrainingTicketsSchemaInfo();
  if (!schema.table) {
    redirect('/admin/training-tickets?error=db_missing');
  }
  // Enforce the new fields so we don't silently drop rubric data.
  if (!schema.hasRubric || !schema.hasNotesSplit) {
    redirect('/admin/training-tickets?error=db_migrate');
  }

  const studentCid = normalizeInt(formData.get('student_cid'));
  // Only senior training staff can set mentor CID to someone else.
  const mentorCid = viewAll ? (normalizeInt(formData.get('mentor_cid')) ?? actor.cid) : actor.cid;
  const lessonPlanId = normalizeInt(formData.get('lesson_plan_id'));
  const sessionType = normalizeText(formData.get('session_type'));
  const sessionStart = normalizeDate(formData.get('session_start'));
  const durationMinutes = normalizeInt(formData.get('duration_minutes')) ?? 0;

  const noShow = normalizeBool(formData.get('no_show')) ?? false;
  const scenarioSummary = normalizeText(formData.get('scenario_summary'));

  const notes = normalizeText(formData.get('notes'));
  const notesStudent = normalizeText(formData.get('notes_student'));
  const notesFuture = normalizeText(formData.get('notes_future'));

  const { ratings, checks } = parseRubric(formData);

  if (!studentCid || !mentorCid || !sessionType || !sessionStart) {
    // Keep it simple: bounce back with query param.
    redirect('/admin/training-tickets/new?error=missing');
  }

  await insertDynamic('training_tickets', {
    student_cid: studentCid,
    mentor_cid: mentorCid,
    lesson_plan_id: lessonPlanId,
    session_type: sessionType,
    session_start: sessionStart,
    duration_minutes: noShow ? 0 : durationMinutes,

    no_show: noShow,
    scenario_summary: scenarioSummary,

    notes,
    notes_student: notesStudent,
    notes_future: notesFuture,

    rubric_ratings: JSON.stringify(ratings),
    rubric_checks: JSON.stringify(checks),

    updated_at: new Date().toISOString(),
  });

  revalidatePath('/admin/training-tickets');
  redirect('/admin/training-tickets?saved=1');
}

export async function updateTrainingTicketAction(id: string, formData: FormData) {
  const actor = await requireTrainingTicketWriter();
  const viewAll = canViewAllTrainingTickets(actor);

  const schema = await getTrainingTicketsSchemaInfo();
  if (!schema.table) {
    redirect('/admin/training-tickets?error=db_missing');
  }
  if (!schema.hasRubric || !schema.hasNotesSplit) {
    redirect('/admin/training-tickets?error=db_migrate');
  }

  const existing = await getById('training_tickets', id);
  if (!existing) redirect('/admin/training-tickets?error=not_found');
  if (!canEditTrainingTicket(actor, existing)) {
    // Don't leak that the id exists.
    redirect('/admin/training-tickets?error=not_found');
  }

  const studentCid = normalizeInt(formData.get('student_cid'));
  const mentorCid = viewAll
    ? normalizeInt(formData.get('mentor_cid'))
    : Number.parseInt(String(existing.mentor_cid ?? actor.cid), 10);
  const lessonPlanId = normalizeInt(formData.get('lesson_plan_id'));
  const sessionType = normalizeText(formData.get('session_type'));
  const sessionStart = normalizeDate(formData.get('session_start'));
  const durationMinutes = normalizeInt(formData.get('duration_minutes')) ?? 0;

  const noShow = normalizeBool(formData.get('no_show')) ?? false;
  const scenarioSummary = normalizeText(formData.get('scenario_summary'));

  const notes = normalizeText(formData.get('notes'));
  const notesStudent = normalizeText(formData.get('notes_student'));
  const notesFuture = normalizeText(formData.get('notes_future'));

  const { ratings, checks } = parseRubric(formData);

  if (!studentCid || !mentorCid || !sessionType || !sessionStart) {
    redirect(`/admin/training-tickets/${encodeURIComponent(String(id))}?error=missing`);
  }

  await updateDynamic('training_tickets', id, {
    student_cid: studentCid,
    mentor_cid: mentorCid,
    lesson_plan_id: lessonPlanId,
    session_type: sessionType,
    session_start: sessionStart,
    duration_minutes: noShow ? 0 : durationMinutes,

    no_show: noShow,
    scenario_summary: scenarioSummary,

    notes,
    notes_student: notesStudent,
    notes_future: notesFuture,

    rubric_ratings: JSON.stringify(ratings),
    rubric_checks: JSON.stringify(checks),

    updated_at: new Date().toISOString(),
  });

  revalidatePath('/admin/training-tickets');
  revalidatePath(`/admin/training-tickets/${encodeURIComponent(String(id))}`);
  redirect(`/admin/training-tickets/${encodeURIComponent(String(id))}?saved=1`);
}

export async function deleteTrainingTicketAction(id: string) {
  // Only true admin-tier users can delete tickets.
  await requireSiteAdminOnly();

  await deleteById('training_tickets', id);

  revalidatePath('/admin/training-tickets');
  redirect('/admin/training-tickets?deleted=1');
}
