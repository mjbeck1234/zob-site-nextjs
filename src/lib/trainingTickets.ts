import { sql } from '@/lib/db';
import { tableExists, tableHasColumn } from '@/lib/schema';

export type TrainingSessionType = 'sweatbox' | 'on_the_job' | 'classroom' | 'mentor_in_training';

export const TRAINING_SESSION_TYPES: Array<{ value: TrainingSessionType; label: string }> = [
  { value: 'sweatbox', label: 'Sweatbox' },
  { value: 'on_the_job', label: 'On-the-Job Training' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'mentor_in_training', label: 'Mentor-in-Training' },
];

export async function getTrainingTicketsSchemaInfo() {
  const table = await tableExists('training_tickets').catch(() => false);
  if (!table) {
    return {
      table: false,
      hasNoShow: false,
      hasRubric: false,
      hasNotesSplit: false,
      hasUpdatedAt: false,
    };
  }

  const hasNoShow = await tableHasColumn('training_tickets', 'no_show').catch(() => false);
  const hasRubric =
    (await tableHasColumn('training_tickets', 'rubric_ratings').catch(() => false)) &&
    (await tableHasColumn('training_tickets', 'rubric_checks').catch(() => false));
  const hasNotesSplit =
    (await tableHasColumn('training_tickets', 'notes_student').catch(() => false)) &&
    (await tableHasColumn('training_tickets', 'notes_future').catch(() => false));
  const hasUpdatedAt = await tableHasColumn('training_tickets', 'updated_at').catch(() => false);

  return { table: true, hasNoShow, hasRubric, hasNotesSplit, hasUpdatedAt };
}

export async function hasTrainingTicketsTable(): Promise<boolean> {
  const info = await getTrainingTicketsSchemaInfo();
  return info.table;
}

/**
 * Profile-facing enablement check.
 *
 * The existing ZOB MySQL schema stores tickets in a `tickets` table.
 * New installs use `training_tickets`.
 */
export async function trainingTicketsEnabledForProfile(): Promise<{ enabled: boolean; hasNew: boolean; hasStored: boolean }> {
  const hasNew = await tableExists('training_tickets').catch(() => false);
  const hasStored = await tableExists('tickets').catch(() => false);
  return { enabled: Boolean(hasNew || hasStored), hasNew: Boolean(hasNew), hasStored: Boolean(hasStored) };
}

function normalizeStoredSessionType(trainingType: any): string {
  const s = String(trainingType ?? '').toLowerCase();
  if (s.includes('sweatbox')) return 'sweatbox';
  if (s.includes('on-the-job') || s.includes('on the job') || s.includes('ojt')) return 'on_the_job';
  if (s.includes('classroom')) return 'classroom';
  if (s.includes('mentor') && s.includes('training')) return 'mentor_in_training';
  return String(trainingType ?? '').trim();
}

async function listStoredTicketsForStudent(studentCid: number, limit: number) {
  const hasStored = await tableExists('tickets').catch(() => false);
  if (!hasStored) return [] as any[];

  // Map existing `tickets` -> the newer training_tickets-like shape used in profile UI.
  // NOTE: controller_notes are "notes to student"; observer_notes are treated as mentor-only.
  const q = `
    SELECT
      id,
      CAST(observer_cid AS UNSIGNED) AS mentor_cid,
      observer_name AS mentor_name,
      CAST(controller_cid AS UNSIGNED) AS student_cid,
      controller_name AS student_name,
      training_category,
      training_type,
      date AS session_start,
      date AS created_at,
      time_elapsed,
      controller_notes AS notes_student,
      observer_notes AS notes_future,
      ots_recommendation,
      mtr_checkout,
      number_of_movements,
      CASE
        WHEN time_elapsed REGEXP '^[0-9]+:[0-9][0-9]$'
          THEN CAST(SUBSTRING_INDEX(time_elapsed, ':', 1) AS UNSIGNED) * 60 + CAST(SUBSTRING_INDEX(time_elapsed, ':', -1) AS UNSIGNED)
        ELSE 0
      END AS duration_minutes
    FROM tickets
    WHERE controller_cid = $1
    ORDER BY date DESC, id DESC
    LIMIT ${Math.min(Math.max(limit, 1), 500)}
  `;

  const rows = await sql.unsafe<any[]>(q, [String(studentCid)]);
  return rows.map((r) => ({
    ...r,
    session_type: normalizeStoredSessionType(r.training_type),
    no_show: false,
    rubric_ratings: null,
    rubric_checks: null,
    updated_at: null,
    source: 'tickets',
  }));
}

export async function listTrainingTickets(limit = 200) {
  const info = await getTrainingTicketsSchemaInfo();
  if (!info.table) return [];
  return sql<any[]>`
    SELECT *
    FROM training_tickets
    ORDER BY session_start DESC, id DESC
    LIMIT ${limit}
  `;
}

export async function listTrainingTicketsForStudent(studentCid: number, limit = 200) {
  const lim = Math.min(Math.max(limit, 1), 500);

  const hasNew = await tableExists('training_tickets').catch(() => false);
  const hasStored = await tableExists('tickets').catch(() => false);
  if (!hasNew && !hasStored) return [];

  const newRows = hasNew
    ? await sql<any[]>`
        SELECT *, 'training_tickets' AS source
        FROM training_tickets
        WHERE student_cid = ${studentCid}
        ORDER BY (session_start IS NULL) ASC, session_start DESC, id DESC
        LIMIT ${lim}
      `
    : ([] as any[]);

  const existingRows = hasStored ? await listStoredTicketsForStudent(studentCid, lim) : ([] as any[]);

  // Merge and order by session_start desc.
  const all = [...newRows, ...existingRows].sort((a: any, b: any) => {
    const ad = a?.session_start ? new Date(String(a.session_start)).getTime() : 0;
    const bd = b?.session_start ? new Date(String(b.session_start)).getTime() : 0;
    if (bd !== ad) return bd - ad;
    return Number(b?.id ?? 0) - Number(a?.id ?? 0);
  });

  return all.slice(0, lim);
}

export async function listTrainingTicketsForMentor(mentorCid: number, limit = 200) {
  const info = await getTrainingTicketsSchemaInfo();
  if (!info.table) return [];
  return sql<any[]>`
    SELECT *
    FROM training_tickets
    WHERE mentor_cid = ${mentorCid}
    ORDER BY (session_start IS NULL) ASC, session_start DESC, id DESC
    LIMIT ${limit}
  `;
}

export async function getTrainingTicketForStudent(id: number, studentCid: number) {
  const hasNew = await tableExists('training_tickets').catch(() => false);
  const hasStored = await tableExists('tickets').catch(() => false);
  if (!hasNew && !hasStored) return null;

  if (hasNew) {
    const rows = await sql<any[]>`
      SELECT *, 'training_tickets' AS source
      FROM training_tickets
      WHERE id = ${id} AND student_cid = ${studentCid}
      LIMIT 1
    `;
    if (rows?.[0]) return rows[0];
  }

  if (hasStored) {
    const q = `
      SELECT
        id,
        CAST(observer_cid AS UNSIGNED) AS mentor_cid,
        observer_name AS mentor_name,
        CAST(controller_cid AS UNSIGNED) AS student_cid,
        controller_name AS student_name,
        training_category,
        training_type,
        date AS session_start,
        date AS created_at,
        time_elapsed,
        controller_notes AS notes_student,
        observer_notes AS notes_future,
        ots_recommendation,
        mtr_checkout,
        number_of_movements,
        CASE
          WHEN time_elapsed REGEXP '^[0-9]+:[0-9][0-9]$'
            THEN CAST(SUBSTRING_INDEX(time_elapsed, ':', 1) AS UNSIGNED) * 60 + CAST(SUBSTRING_INDEX(time_elapsed, ':', -1) AS UNSIGNED)
          ELSE 0
        END AS duration_minutes
      FROM tickets
      WHERE id = $1 AND controller_cid = $2
      LIMIT 1
    `;
    const rows = await sql.unsafe<any[]>(q, [String(id), String(studentCid)]);
    const r = rows?.[0];
    if (!r) return null;
    return {
      ...r,
      session_type: normalizeStoredSessionType(r.training_type),
      no_show: false,
      rubric_ratings: null,
      rubric_checks: null,
      updated_at: null,
      source: 'tickets',
    };
  }

  return null;
}

export async function getTrainingTicketStats(monthsBack = 12) {
  const info = await getTrainingTicketsSchemaInfo();
  if (!info.table) {
    return {
      perMonth: [] as Array<{ month: string; count: number }>,
      perMentorMonth: [] as Array<{ month: string; mentor_cid: number; count: number }>,
      byType: [] as Array<{ session_type: string; count: number }>,
    };
  }

  // Optionally exclude no-shows from stats.
  const excludeNoShow = info.hasNoShow;

  const perMonth = excludeNoShow
    ? await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               COUNT(*) AS count
        FROM training_tickets
        WHERE session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
          AND COALESCE(no_show, 0) = 0
        GROUP BY 1
        ORDER BY 1 ASC
      `
    : await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               COUNT(*) AS count
        FROM training_tickets
        WHERE session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
        GROUP BY 1
        ORDER BY 1 ASC
      `;

  const perMentorMonth = excludeNoShow
    ? await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               CAST(mentor_cid AS UNSIGNED) AS mentor_cid,
               COUNT(*) AS count
        FROM training_tickets
        WHERE session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
          AND COALESCE(no_show, 0) = 0
        GROUP BY 1, 2
        ORDER BY 1 ASC, 3 DESC
      `
    : await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               CAST(mentor_cid AS UNSIGNED) AS mentor_cid,
               COUNT(*) AS count
        FROM training_tickets
        WHERE session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
        GROUP BY 1, 2
        ORDER BY 1 ASC, 3 DESC
      `;

  const byType = excludeNoShow
    ? await sql<any[]>`
        SELECT session_type AS session_type,
               COUNT(*) AS count
        FROM training_tickets
        WHERE session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
          AND COALESCE(no_show, 0) = 0
        GROUP BY 1
        ORDER BY 2 DESC
      `
    : await sql<any[]>`
        SELECT session_type AS session_type,
               COUNT(*) AS count
        FROM training_tickets
        WHERE session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
        GROUP BY 1
        ORDER BY 2 DESC
      `;

  return { perMonth, perMentorMonth, byType };
}

/**
 * Scoped stats for a single mentor.
 *
 * Used to avoid exposing aggregate facility-wide information to non-senior training staff.
 */
export async function getTrainingTicketStatsForMentor(mentorCid: number, monthsBack = 12) {
  const info = await getTrainingTicketsSchemaInfo();
  if (!info.table) {
    return {
      perMonth: [] as Array<{ month: string; count: number }>,
      perMentorMonth: [] as Array<{ month: string; mentor_cid: number; count: number }>,
      byType: [] as Array<{ session_type: string; count: number }>,
    };
  }

  const excludeNoShow = info.hasNoShow;

  const perMonth = excludeNoShow
    ? await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               COUNT(*) AS count
        FROM training_tickets
        WHERE mentor_cid = ${mentorCid}
          AND session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
          AND COALESCE(no_show, 0) = 0
        GROUP BY 1
        ORDER BY 1 ASC
      `
    : await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               COUNT(*) AS count
        FROM training_tickets
        WHERE mentor_cid = ${mentorCid}
          AND session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
        GROUP BY 1
        ORDER BY 1 ASC
      `;

  // Keep the same shape as facility-wide stats.
  const perMentorMonth = excludeNoShow
    ? await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               CAST(mentor_cid AS UNSIGNED) AS mentor_cid,
               COUNT(*) AS count
        FROM training_tickets
        WHERE mentor_cid = ${mentorCid}
          AND session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
          AND COALESCE(no_show, 0) = 0
        GROUP BY 1, 2
        ORDER BY 1 ASC, 3 DESC
      `
    : await sql<any[]>`
        SELECT DATE_FORMAT(session_start, '%Y-%m') AS month,
               CAST(mentor_cid AS UNSIGNED) AS mentor_cid,
               COUNT(*) AS count
        FROM training_tickets
        WHERE mentor_cid = ${mentorCid}
          AND session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
        GROUP BY 1, 2
        ORDER BY 1 ASC, 3 DESC
      `;

  const byType = excludeNoShow
    ? await sql<any[]>`
        SELECT session_type AS session_type,
               COUNT(*) AS count
        FROM training_tickets
        WHERE mentor_cid = ${mentorCid}
          AND session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
          AND COALESCE(no_show, 0) = 0
        GROUP BY 1
        ORDER BY 2 DESC
      `
    : await sql<any[]>`
        SELECT session_type AS session_type,
               COUNT(*) AS count
        FROM training_tickets
        WHERE mentor_cid = ${mentorCid}
          AND session_start >= DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH)
        GROUP BY 1
        ORDER BY 2 DESC
      `;

  return { perMonth, perMentorMonth, byType };
}


