import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteById, getById, insertDynamic, normalizeText, updateDynamic } from '@/lib/admin/crud';
import { requireLessonPlansEditor } from '@/lib/auth/guards';

function toInt(v: any): number {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function getStr(formData: FormData, key: string, maxLen?: number): string {
  const raw = formData.get(key);
  return normalizeText(raw, maxLen ? { maxLen } : undefined) || '';
}

/**
 * Schema compatibility:
 * The old ZOB site stored lesson plan free-text fields as simple HTML with <br> for line breaks.
 * If an editor enters plain text, convert newlines to <br /> so the previous site renders it correctly.
 * If the editor pastes HTML, keep it as-is.
 */
function sanitizeAndNormalizeHtml(input: string): string {
  let s = (input ?? '').toString();
  if (!s.trim()) return '';

  // Strip dangerous blocks.
  s = s.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  s = s.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');

  // Remove event handlers + inline styling (existing content sometimes forces black text).
  s = s.replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\sstyle=("[^"]*"|'[^']*')/gi, '');
  s = s.replace(/\sclass=("[^"]*"|'[^']*')/gi, '');

  // Unwrap common existing tags.
  s = s.replace(/<\/?(span|font)[^>]*>/gi, '');

  // Convert block-ish tags to <br> so the previous site renders line breaks.
  s = s.replace(/<\/?\s*div[^>]*>/gi, (m) => (m.startsWith('</') ? '<br />' : ''));
  s = s.replace(/<\/?\s*p[^>]*>/gi, (m) => (m.startsWith('</') ? '<br /><br />' : ''));

  // Normalize <br> variants.
  s = s.replace(/<br\s*\/?\s*>/gi, '<br />');

  // Sanitize links (no javascript:)
  s = s.replace(/<a\b[^>]*>/gi, (tag) => {
    const hrefMatch = tag.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const hrefRaw = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : '';
    const href = hrefRaw.trim();
    const safeHref = /^\s*javascript:/i.test(href) ? '#' : href;
    const safe = safeHref || '#';
    return `<a href="${safe.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">`;
  });

  // Drop tags we don't explicitly support.
  s = s.replace(/<\/?(?!br\b|b\b|strong\b|i\b|em\b|u\b|ul\b|ol\b|li\b|a\b)[a-z0-9]+(?:\s[^>]*)?>/gi, '');

  // Collapse excessive breaks.
  s = s.replace(/(?:<br \/>\s*){4,}/g, '<br /><br />');
  return s.trim();
}

function toHtmlContent(text: string): string {
  const s = (text ?? '').toString();
  if (!s.trim()) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(s);
  if (looksLikeHtml) return sanitizeAndNormalizeHtml(s);
  return s.replace(/\r?\n/g, '<br />\n');
}

/** Create */
export async function createLessonPlanAction(formData: FormData) {
  'use server';
  await requireLessonPlansEditor();

  const trackId = toInt(formData.get('track_id'));
  if (!Number.isFinite(trackId)) redirect('/admin/lesson-plans/new?error=bad_track');

  const lessonName = getStr(formData, 'lesson_name', 256);
  if (!lessonName) redirect('/admin/lesson-plans/new?error=missing_name');

  const location = getStr(formData, 'location', 3);
  const workload = getStr(formData, 'workload', 16);

  const time = toInt(formData.get('time'));
  if (!Number.isFinite(time)) redirect('/admin/lesson-plans/new?error=bad_time');

  const sessionOrientation = getStr(formData, 'session_orientation', 256);
  const theory = toHtmlContent(getStr(formData, 'theory'));
  const competencies = toHtmlContent(getStr(formData, 'competencies'));
  const approvedSweatboxFiles = toHtmlContent(getStr(formData, 'approved_sweatbox_files'));
  const notes = toHtmlContent(getStr(formData, 'notes'));

  const row = await insertDynamic('lesson_plans', {
    track_id: trackId,
    lesson_name: lessonName,
    location,
    workload,
    time,
    session_orientation: sessionOrientation,
    theory,
    competencies,
    approved_sweatbox_files: approvedSweatboxFiles,
    notes,
  });

  revalidatePath('/admin/lesson-plans');
  redirect(`/admin/lesson-plans/${row.id}`);
}

/** Update */
export async function updateLessonPlanAction(formData: FormData) {
  'use server';
  await requireLessonPlansEditor();

  const id = getStr(formData, 'id');
  if (!id) redirect('/admin/lesson-plans?error=missing_id');

  // Ensure it exists.
  await getById('lesson_plans', id).catch(() => null);

  const trackId = toInt(formData.get('track_id'));
  if (!Number.isFinite(trackId)) redirect(`/admin/lesson-plans/${id}?edit=1&error=bad_track`);

  const lessonName = getStr(formData, 'lesson_name', 256);
  if (!lessonName) redirect(`/admin/lesson-plans/${id}?edit=1&error=missing_name`);

  const location = getStr(formData, 'location', 3);
  const workload = getStr(formData, 'workload', 16);

  const time = toInt(formData.get('time'));
  if (!Number.isFinite(time)) redirect(`/admin/lesson-plans/${id}?edit=1&error=bad_time`);

  const sessionOrientation = getStr(formData, 'session_orientation', 256);
  const theory = toHtmlContent(getStr(formData, 'theory'));
  const competencies = toHtmlContent(getStr(formData, 'competencies'));
  const approvedSweatboxFiles = toHtmlContent(getStr(formData, 'approved_sweatbox_files'));
  const notes = toHtmlContent(getStr(formData, 'notes'));

  await updateDynamic('lesson_plans', id, {
    track_id: trackId,
    lesson_name: lessonName,
    location,
    workload,
    time,
    session_orientation: sessionOrientation,
    theory,
    competencies,
    approved_sweatbox_files: approvedSweatboxFiles,
    notes,
  });

  revalidatePath('/admin/lesson-plans');
  revalidatePath(`/admin/lesson-plans/${id}`);
  redirect(`/admin/lesson-plans/${id}`);
}

/** Delete */
export async function deleteLessonPlanAction(formData: FormData) {
  'use server';
  await requireLessonPlansEditor();

  const id = getStr(formData, 'id');
  if (!id) redirect('/admin/lesson-plans?error=missing_id');

  await deleteById('lesson_plans', id);
  revalidatePath('/admin/lesson-plans');
  redirect('/admin/lesson-plans');
}
