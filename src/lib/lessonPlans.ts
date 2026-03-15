import { sql } from './db';

/**
 * Matches the existing existing `lesson_plans` schema in your MySQL DB.
 *
 * DESCRIBE lesson_plans;
 * - id (PK)
 * - track_id (int)
 * - lesson_name (varchar)
 * - location (varchar(3))
 * - workload (varchar)
 * - time (int)
 * - session_orientation (varchar)
 * - theory (text)
 * - competencies (text)
 * - approved_sweatbox_files (text)
 * - notes (text)
 * - updated_at (timestamp)
 * - created_at (timestamp)
 */
export type LessonPlanRow = {
  id: number;
  track_id: number;
  lesson_name: string;
  location: string;
  workload: string;
  time: number;
  session_orientation: string;
  theory: string;
  competencies: string;
  approved_sweatbox_files: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export async function lessonPlansEnabled(): Promise<boolean> {
  // If the table exists, we consider it enabled.
  try {
    const r = await sql<{ ok: number }[]>`
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'lesson_plans'
      LIMIT 1
    `;
    return Array.isArray(r) && r.length > 0;
  } catch {
    return false;
  }
}

export async function listLessonPlans(): Promise<LessonPlanRow[]> {
  // Order by track, then location, then lesson name for stable UI grouping.
  const rows = await sql<LessonPlanRow[]>`
    SELECT
      id,
      track_id,
      lesson_name,
      location,
      workload,
      time,
      session_orientation,
      theory,
      competencies,
      approved_sweatbox_files,
      notes,
      created_at,
      updated_at
    FROM lesson_plans
    ORDER BY track_id ASC, location ASC, lesson_name ASC
  `;
  return Array.isArray(rows) ? rows : [];
}

export async function getLessonPlanById(id: number): Promise<LessonPlanRow | null> {
  const rows = await sql<LessonPlanRow[]>`
    SELECT
      id,
      track_id,
      lesson_name,
      location,
      workload,
      time,
      session_orientation,
      theory,
      competencies,
      approved_sweatbox_files,
      notes,
      created_at,
      updated_at
    FROM lesson_plans
    WHERE id = ${id}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}
