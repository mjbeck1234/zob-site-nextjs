import { sql } from '@/lib/db';
import { insertDynamic } from '@/lib/admin/crud';
import { tableExists } from '@/lib/schema';
import type { SessionUser } from '@/lib/auth/session';

export type ExamRow = {
  id: number;
  title: string;
  description: string | null;
  pass_percent: number;
  published: boolean;
  archived: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ExamQuestionRow = {
  id: number;
  exam_id: number;
  qtype: 'mcq' | 'written' | string;
  prompt: string;
  points: number;
  sort_order: number;
  correct_choice_id: number | null;
};

export type ExamChoiceRow = {
  id: number;
  question_id: number;
  choice_text: string;
  sort_order: number;
};

export type ExamAttemptRow = {
  id: number;
  exam_id: number;
  student_cid: number;
  student_name: string | null;
  status: 'in_progress' | 'needs_review' | 'graded' | string;
  result: 'pass' | 'fail' | null;
  locked: boolean;
  question_order: any;
  choice_order: any;
  earned_points: number;
  total_points: number;
  score_percent: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reset_by_cid: number | null;
  reset_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ExamAnswerRow = {
  id: number;
  attempt_id: number;
  question_id: number;
  selected_choice_id: number | null;
  written_text: string | null;
  points_awarded: number | null;
  mentor_comment: string | null;
};

export type QuestionWithChoices = ExamQuestionRow & { choices: ExamChoiceRow[] };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function isStoredExamsTable(): Promise<boolean> {
  return true;
}

async function isStoredExamQuestionsTable(): Promise<boolean> {
  return true;
}

function storedChoiceId(questionId: number, optionIndex1Based: number): number {
  // Deterministic synthetic id for a choice when there is no exam_choices table.
  // Ex: qid=123 -> choices 1231, 1232, 1233, 1234
  return Number(`${questionId}${optionIndex1Based}`);
}

function normalizeStoredBool(v: any): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
}

function storedTruthFalseChoices() {
  return ['True', 'False'];
}

export async function examsEnabled(): Promise<boolean> {
  return await tableExists('exams').catch(() => false);
}

export async function listPublishedExams(): Promise<ExamRow[]> {
  const ok = await examsEnabled();
  if (!ok) return [];

  const existing = await isStoredExamsTable();

  const hasTitle = true;
  const hasDesc = false;
  const hasPassPercent = false;
  const hasPassingScore = true;
  const hasPublished = false;
  const hasArchived = false;
  const hasCreated = true;
  const hasUpdated = true;

  const rows = await sql<any[]>`
    SELECT
      id,
      ${hasTitle ? sql`title` : sql`''`} AS title,
      ${hasDesc ? sql`description` : sql`NULL`} AS description,
      ${hasPassPercent ? sql`pass_percent` : hasPassingScore ? sql`passing_score` : sql`80`} AS pass_percent,
      ${
        hasPublished
          ? existing
            ? sql`(LOWER(CAST(published AS CHAR)) IN ('yes','y','true','1'))`
            : sql`(published = TRUE)`
          : sql`TRUE`
      } AS published,
      ${
        hasArchived
          ? sql`(archived = TRUE OR archived = 1 OR archived = '1')`
          : sql`FALSE`
      } AS archived,
      ${hasCreated ? sql`created_at` : sql`NULL`} AS created_at,
      ${hasUpdated ? sql`updated_at` : sql`NULL`} AS updated_at
    FROM exams
    WHERE ${
      hasPublished
        ? existing
          ? sql`(LOWER(CAST(published AS CHAR)) IN ('yes','y','true','1'))`
          : sql`(published = TRUE)`
        : sql`TRUE`
    }
      AND ${
        hasArchived
          ? sql`NOT (archived = TRUE OR archived = 1 OR archived = '1')`
          : sql`TRUE`
      }
    ORDER BY id DESC
  `;

  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    title: String(r.title ?? ''),
    description: r.description ?? null,
    pass_percent: Number(r.pass_percent ?? 0),
    published: normalizeStoredBool(r.published),
    archived: normalizeStoredBool(r.archived),
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  })) as ExamRow[];
}

export async function listAllExams(): Promise<ExamRow[]> {
  const ok = await examsEnabled();
  if (!ok) return [];

  const existing = await isStoredExamsTable();

  const hasTitle = true;
  const hasDesc = false;
  const hasPassPercent = false;
  const hasPassingScore = true;
  const hasPublished = false;
  const hasArchived = false;
  const hasCreated = true;
  const hasUpdated = true;

  const rows = await sql<any[]>`
    SELECT
      id,
      ${hasTitle ? sql`title` : sql`''`} AS title,
      ${hasDesc ? sql`description` : sql`NULL`} AS description,
      ${hasPassPercent ? sql`pass_percent` : hasPassingScore ? sql`passing_score` : sql`80`} AS pass_percent,
      ${
        hasPublished
          ? existing
            ? sql`(LOWER(CAST(published AS CHAR)) IN ('yes','y','true','1'))`
            : sql`(published = TRUE)`
          : sql`TRUE`
      } AS published,
      ${
        hasArchived
          ? sql`(archived = TRUE OR archived = 1 OR archived = '1')`
          : sql`FALSE`
      } AS archived,
      ${hasCreated ? sql`created_at` : sql`NULL`} AS created_at,
      ${hasUpdated ? sql`updated_at` : sql`NULL`} AS updated_at
    FROM exams
    ORDER BY id DESC
  `;

  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    title: String(r.title ?? ''),
    description: r.description ?? null,
    pass_percent: Number(r.pass_percent ?? 0),
    published: normalizeStoredBool(r.published),
    archived: normalizeStoredBool(r.archived),
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  })) as ExamRow[];
}

export async function getExamById(examId: string | number): Promise<ExamRow | null> {
  const ok = await examsEnabled();
  if (!ok) return null;

  const existing = await isStoredExamsTable();

  const hasTitle = true;
  const hasDesc = false;
  const hasPassPercent = false;
  const hasPassingScore = true;
  const hasPublished = false;
  const hasArchived = false;
  const hasCreated = true;
  const hasUpdated = true;

  const rows = await sql<any[]>`
    SELECT
      id,
      ${hasTitle ? sql`title` : sql`''`} AS title,
      ${hasDesc ? sql`description` : sql`NULL`} AS description,
      ${hasPassPercent ? sql`pass_percent` : hasPassingScore ? sql`passing_score` : sql`80`} AS pass_percent,
      ${
        hasPublished
          ? existing
            ? sql`(LOWER(CAST(published AS CHAR)) IN ('yes','y','true','1'))`
            : sql`(published = TRUE)`
          : sql`TRUE`
      } AS published,
      ${
        hasArchived
          ? sql`(archived = TRUE OR archived = 1 OR archived = '1')`
          : sql`FALSE`
      } AS archived,
      ${hasCreated ? sql`created_at` : sql`NULL`} AS created_at,
      ${hasUpdated ? sql`updated_at` : sql`NULL`} AS updated_at
    FROM exams
    WHERE id = ${examId}
    LIMIT 1
  `;

  const r = rows?.[0];
  if (!r) return null;

  return {
    id: Number(r.id),
    title: String(r.title ?? ''),
    description: r.description ?? null,
    pass_percent: Number(r.pass_percent ?? 0),
    published: normalizeStoredBool(r.published),
    archived: normalizeStoredBool(r.archived),
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  } as ExamRow;
}

export async function getExamQuestions(examId: string | number): Promise<ExamQuestionRow[]> {
  const ok = await tableExists('exam_questions');
  if (!ok) return [];

  const existing = await isStoredExamQuestionsTable();

  if (existing) {
    type StoredQ = {
      id: number;
      exam_id: number;
      content: string;
      type: number;
      answer: string | null;
      d1: string | null;
      d2: string | null;
      d3: string | null;
    };

    const rows = await sql<StoredQ[]>`
      SELECT id, exam_id, content, type, answer, d1, d2, d3
      FROM exam_questions
      WHERE exam_id = ${examId}
      ORDER BY id ASC
    `;

    return (rows ?? []).map((r) => {
      const qid = Number(r.id);
      const qtypeNum = Number(r.type ?? 0);
      const isTF = qtypeNum === 1;
      const correct = isTF
        ? storedChoiceId(qid, String(r.answer ?? '').trim().toLowerCase().startsWith('t') ? 1 : 2)
        : storedChoiceId(qid, 1);

      return {
        id: qid,
        exam_id: Number(r.exam_id),
        qtype: qtypeNum === 2 ? 'written' : 'mcq',
        prompt: String(r.content ?? ''),
        points: 1,
        sort_order: qid,
        correct_choice_id: qtypeNum === 2 ? null : correct,
      } as ExamQuestionRow;
    });
  }

  // New schema
  return await sql<ExamQuestionRow[]>`
    SELECT id, exam_id, qtype, prompt, points, sort_order, correct_choice_id
    FROM exam_questions
    WHERE exam_id = ${examId}
    ORDER BY sort_order ASC, id ASC
  `;
}

export async function getChoicesForQuestions(questionIds: number[]): Promise<Map<number, ExamChoiceRow[]>> {
  const map = new Map<number, ExamChoiceRow[]>();
  if (questionIds.length === 0) return map;

  const hasChoicesTable = await tableExists('exam_choices').catch(() => false);
  if (hasChoicesTable) {
    const rows = await sql<ExamChoiceRow[]>`
      SELECT id, question_id, choice_text, sort_order
      FROM exam_choices
      WHERE question_id IN ${sql.in(questionIds)}
      ORDER BY sort_order ASC, id ASC
    `;
    for (const r of rows) {
      if (!map.has(r.question_id)) map.set(r.question_id, []);
      map.get(r.question_id)!.push(r);
    }
    return map;
  }

  // Stored schema: choices are embedded in exam_questions as answer + d1/d2/d3 (or True/False).
  type StoredQ = {
    id: number;
    type: number;
    answer: string | null;
    d1: string | null;
    d2: string | null;
    d3: string | null;
  };

  const existingQ = await isStoredExamQuestionsTable();
  if (!existingQ) return map;

  const rows = await sql<StoredQ[]>`
    SELECT id, type, answer, d1, d2, d3
    FROM exam_questions
    WHERE id IN ${sql.in(questionIds)}
    ORDER BY id ASC
  `;

  for (const r of rows ?? []) {
    const qid = Number(r.id);
    const qtypeNum = Number(r.type ?? 0);
    if (qtypeNum === 2) {
      // Written questions (existing type=2) have no choices.
      map.set(Number(r.id), []);
      continue;
    }
    const isTF = qtypeNum === 1;

    let choiceTexts: string[] = [];
    if (isTF) {
      choiceTexts = storedTruthFalseChoices();
    } else {
      const raw = [r.answer, r.d1, r.d2, r.d3].map((x) => (x == null ? '' : String(x).trim())).filter(Boolean);
      // Ensure the correct answer is present and first in the raw list if provided.
      const ans = String(r.answer ?? '').trim();
      if (ans && !raw.some((t) => t === ans)) raw.unshift(ans);
      // Remove duplicates while preserving order
      const seen = new Set<string>();
      choiceTexts = raw.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
      if (choiceTexts.length === 0) choiceTexts = ['(no answer provided)'];
    }

    const choices: ExamChoiceRow[] = choiceTexts.map((t, i) => ({
      id: storedChoiceId(qid, i + 1),
      question_id: qid,
      choice_text: t,
      sort_order: i + 1,
    }));

    map.set(qid, choices);
  }

  return map;
}

export async function getExamQuestionBundle(examId: string | number): Promise<QuestionWithChoices[]> {
  const questions = await getExamQuestions(examId);
  const qids = questions.map((q) => q.id);
  const choices = await getChoicesForQuestions(qids);
  return questions.map((q) => ({ ...q, choices: choices.get(q.id) ?? [] }));
}

export async function getStudentLockedAttempt(examId: number, cid: number): Promise<ExamAttemptRow | null> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return null;
  const rows = await sql<ExamAttemptRow[]>`
    SELECT *
    FROM exam_attempts
    WHERE exam_id = ${examId} AND student_cid = ${cid} AND locked = TRUE AND result = 'fail'
    ORDER BY id DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getInProgressAttempt(examId: number, cid: number): Promise<ExamAttemptRow | null> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return null;
  const rows = await sql<ExamAttemptRow[]>`
    SELECT *
    FROM exam_attempts
    WHERE exam_id = ${examId} AND student_cid = ${cid} AND status = 'in_progress'
    ORDER BY id DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getNeedsReviewAttempt(examId: number, cid: number): Promise<ExamAttemptRow | null> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return null;
  const rows = await sql<ExamAttemptRow[]>`
    SELECT *
    FROM exam_attempts
    WHERE exam_id = ${examId} AND student_cid = ${cid} AND status = 'needs_review'
    ORDER BY id DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createAttempt(examId: number, user: SessionUser, bundle: QuestionWithChoices[]): Promise<ExamAttemptRow> {
  const questionOrder = shuffle(bundle.map((q) => q.id));
  const choiceOrder: Record<string, number[]> = {};
  for (const q of bundle) {
    if (String(q.qtype) === 'mcq') {
      choiceOrder[String(q.id)] = shuffle((q.choices ?? []).map((c) => c.id));
    }
  }

  const rows = await sql<ExamAttemptRow[]>`
    INSERT INTO exam_attempts (exam_id, student_cid, student_name, status, question_order, choice_order)
    VALUES (${examId}, ${user.cid}, ${user.fullName ?? null}, 'in_progress', ${sql.json(questionOrder)}, ${sql.json(choiceOrder)})
    RETURNING *
  `;
  return rows[0] as ExamAttemptRow;
}

export async function startOrResumeAttempt(examId: number, user: SessionUser): Promise<
  | { kind: 'locked'; attempt: ExamAttemptRow }
  | { kind: 'pending'; attempt: ExamAttemptRow }
  | { kind: 'ok'; attempt: ExamAttemptRow }
  | { kind: 'missing' }
  | { kind: 'no_questions' }
> {
  const exam = await getExamById(examId);
  if (!exam) return { kind: 'missing' };

  const locked = await getStudentLockedAttempt(examId, user.cid);
  if (locked) return { kind: 'locked', attempt: locked };

  const pending = await getNeedsReviewAttempt(examId, user.cid);
  if (pending) return { kind: 'pending', attempt: pending };

  const existing = await getInProgressAttempt(examId, user.cid);
  if (existing) return { kind: 'ok', attempt: existing };

  const bundle = await getExamQuestionBundle(examId);
  if (bundle.length === 0) return { kind: 'no_questions' };

  const attempt = await createAttempt(examId, user, bundle);
  return { kind: 'ok', attempt };
}

export async function getAnswersForAttempt(attemptId: number): Promise<Map<number, ExamAnswerRow>> {
  const ok = await tableExists('exam_answers');
  const map = new Map<number, ExamAnswerRow>();
  if (!ok) return map;
  const rows = await sql<ExamAnswerRow[]>`
    SELECT id, attempt_id, question_id, selected_choice_id, written_text, points_awarded, mentor_comment
    FROM exam_answers
    WHERE attempt_id = ${attemptId}
    ORDER BY id ASC
  `;
  for (const r of rows) map.set(r.question_id, r);
  return map;
}

export async function getAttemptById(attemptId: number): Promise<ExamAttemptRow | null> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return null;
  const rows = await sql<ExamAttemptRow[]>`SELECT * FROM exam_attempts WHERE id = ${attemptId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getAttemptBundleForStudent(attemptId: number, user: SessionUser) {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) return null;
  // exam_attempts.student_cid is BIGINT; postgres.js commonly returns BIGINT values as strings.
  // Compare as strings to avoid false negatives.
  if (String(attempt.student_cid) !== String(user.cid)) return null;

  const exam = await getExamById(attempt.exam_id);
  if (!exam) return null;

  const base = await getExamQuestionBundle(attempt.exam_id);
  const answers = await getAnswersForAttempt(attemptId);

  // Apply stored order if present.
  const qOrder: number[] = Array.isArray(attempt.question_order) ? attempt.question_order : [];
  const byId = new Map(base.map((q) => [q.id, q] as const));
  const ordered: QuestionWithChoices[] = [];
  for (const qid of qOrder) {
    const q = byId.get(Number(qid));
    if (q) ordered.push(q);
  }
  // Append any new questions added after the attempt started.
  for (const q of base) if (!ordered.some((x) => x.id === q.id)) ordered.push(q);

  const cOrder: Record<string, number[]> = attempt.choice_order && typeof attempt.choice_order === 'object' ? attempt.choice_order : {};
  const orderedWithChoices = ordered.map((q) => {
    if (String(q.qtype) !== 'mcq') return q;
    const orderIds = Array.isArray(cOrder[String(q.id)]) ? cOrder[String(q.id)] : [];
    const cById = new Map((q.choices ?? []).map((c) => [c.id, c] as const));
    const oc: ExamChoiceRow[] = [];
    for (const cid of orderIds) {
      const c = cById.get(Number(cid));
      if (c) oc.push(c);
    }
    for (const c of q.choices ?? []) if (!oc.some((x) => x.id === c.id)) oc.push(c);
    return { ...q, choices: oc };
  });

  return {
    exam,
    attempt,
    questions: orderedWithChoices,
    answersByQuestionId: Object.fromEntries(Array.from(answers.entries()).map(([qid, a]) => [String(qid), a])),
  };
}

export async function upsertAnswer(args: {
  attemptId: number;
  questionId: number;
  selectedChoiceId?: number | null;
  writtenText?: string | null;
}) {
  // Avoid creating empty rows when nothing was selected/typed
  const sel = args.selectedChoiceId ?? null;
  const wt = args.writtenText ?? null;
  if (sel == null && wt == null) return;

  const ok = await tableExists('exam_answers');
  if (!ok) throw new Error('Exam answers table not installed.');

  // MySQL-safe "upsert" without relying on a UNIQUE key (current schema may only have indexes).
  const existing = await sql<{ id: number }[]>`
    SELECT id
    FROM exam_answers
    WHERE attempt_id = ${args.attemptId} AND question_id = ${args.questionId}
    ORDER BY id DESC
    LIMIT 1
  `;

  if (existing.length) {
    const id = Number(existing[0].id);
    // Only update the fields the caller provided (undefined means "leave as-is")
    if (args.selectedChoiceId !== undefined && args.writtenText !== undefined) {
      await sql`
        UPDATE exam_answers
        SET selected_choice_id = ${sel},
            written_text = ${wt}
        WHERE id = ${id}
      `;
    } else if (args.selectedChoiceId !== undefined) {
      await sql`
        UPDATE exam_answers
        SET selected_choice_id = ${sel}
        WHERE id = ${id}
      `;
    } else if (args.writtenText !== undefined) {
      await sql`
        UPDATE exam_answers
        SET written_text = ${wt}
        WHERE id = ${id}
      `;
    }
    return;
  }

  await sql`
    INSERT INTO exam_answers (attempt_id, question_id, selected_choice_id, written_text)
    VALUES (${args.attemptId}, ${args.questionId}, ${sel}, ${wt})
  `;
}

export async function submitAttempt(attemptId: number) {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) return null;
  if (attempt.status !== 'in_progress') return attempt;

  const exam = await getExamById(attempt.exam_id);
  if (!exam) return null;
  const questions = await getExamQuestions(attempt.exam_id);
  const answers = await getAnswersForAttempt(attemptId);

  let total = 0;
  let earned = 0;
  let hasWritten = false;

  for (const q of questions) {
    total += Number(q.points ?? 0);
    if (String(q.qtype) === 'written') {
      hasWritten = true;
      continue;
    }
    const a = answers.get(q.id);
    if (a && a.selected_choice_id && q.correct_choice_id && Number(a.selected_choice_id) === Number(q.correct_choice_id)) {
      earned += Number(q.points ?? 0);
    }
  }

  if (hasWritten) {
    await sql`
      UPDATE exam_attempts
      SET status = 'needs_review',
          earned_points = ${earned},
          total_points = ${total},
          score_percent = NULL,
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE id = ${attemptId}
    `;
  } else {
    const score = total > 0 ? Math.floor((earned / total) * 100) : 0;
    const pass = score >= Number(exam.pass_percent ?? 80);
    await sql`
      UPDATE exam_attempts
      SET status = 'graded',
          earned_points = ${earned},
          total_points = ${total},
          score_percent = ${score},
          result = ${pass ? 'pass' : 'fail'},
          locked = ${pass ? false : true},
          submitted_at = NOW(),
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${attemptId}
    `;
  }

  return await getAttemptById(attemptId);
}

export async function listAttemptsNeedingReview(): Promise<Array<ExamAttemptRow & { exam_title: string | null }>> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return [];
  const rows = await sql<any[]>`
    SELECT a.*, e.title as exam_title
    FROM exam_attempts a
    LEFT JOIN exams e ON e.id = a.exam_id
    WHERE a.status = 'needs_review'
    ORDER BY (a.submitted_at IS NULL) ASC, a.submitted_at ASC, a.id ASC
  `;
  return rows as any;
}

export async function getAttemptBundleForStaff(attemptId: number) {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) return null;
  const exam = await getExamById(attempt.exam_id);
  if (!exam) return null;
  const questions = await getExamQuestionBundle(attempt.exam_id);
  const answersMap = await getAnswersForAttempt(attemptId);

  return {
    exam,
    attempt,
    questions,
    answersByQuestionId: Object.fromEntries(Array.from(answersMap.entries()).map(([qid, a]) => [String(qid), a])),
  };
}

export async function gradeAttempt(args: {
  attemptId: number;
  graderCid: number;
  pointsByQuestionId: Record<string, number>;
  commentByQuestionId?: Record<string, string>;
}) {
  const attempt = await getAttemptById(args.attemptId);
  if (!attempt) return null;
  if (attempt.status !== 'needs_review') return attempt;

  const exam = await getExamById(attempt.exam_id);
  if (!exam) return null;
  const questions = await getExamQuestions(attempt.exam_id);
  const answers = await getAnswersForAttempt(args.attemptId);

  // Upsert awarded points/comments for written questions.
  for (const q of questions) {
    if (String(q.qtype) !== 'written') continue;
    const raw = args.pointsByQuestionId[String(q.id)];
    if (raw === undefined || raw === null) continue;
    const clamped = Math.max(0, Math.min(Number(q.points ?? 0), Number(raw)));
    const comment = args.commentByQuestionId?.[String(q.id)];

    const existing: any[] = await sql`
      SELECT id
      FROM exam_answers
      WHERE attempt_id = ${args.attemptId} AND question_id = ${q.id}
      ORDER BY id DESC
      LIMIT 1
    `;

    if (existing?.length) {
      await sql`
        UPDATE exam_answers
        SET points_awarded = ${clamped},
            mentor_comment = ${comment ?? null},
            updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO exam_answers (attempt_id, question_id, points_awarded, mentor_comment)
        VALUES (${args.attemptId}, ${q.id}, ${clamped}, ${comment ?? null})
      `;
    }
  }

  // Recompute totals.
  const refreshed = await getAnswersForAttempt(args.attemptId);
  let total = 0;
  let earned = 0;
  for (const q of questions) {
    total += Number(q.points ?? 0);
    if (String(q.qtype) === 'written') {
      const a = refreshed.get(q.id);
      earned += Number(a?.points_awarded ?? 0);
      continue;
    }
    const a = refreshed.get(q.id) ?? answers.get(q.id);
    if (a && a.selected_choice_id && q.correct_choice_id && Number(a.selected_choice_id) === Number(q.correct_choice_id)) {
      earned += Number(q.points ?? 0);
    }
  }

  const score = total > 0 ? Math.floor((earned / total) * 100) : 0;
  const pass = score >= Number(exam.pass_percent ?? 80);

  await sql`
    UPDATE exam_attempts
    SET status = 'graded',
        earned_points = ${earned},
        total_points = ${total},
        score_percent = ${score},
        result = ${pass ? 'pass' : 'fail'},
        locked = ${pass ? false : true},
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${args.attemptId}
  `;

  return await getAttemptById(args.attemptId);
}

export async function resetFailedAttempt(attemptId: number, resetByCid: number) {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) return null;
  await sql`
    UPDATE exam_attempts
    SET locked = FALSE,
        reset_by_cid = ${resetByCid},
        reset_at = NOW(),
        updated_at = NOW()
    WHERE id = ${attemptId}
  `;
  return await getAttemptById(attemptId);
}

export async function getLatestAttemptForStudent(examId: number, cid: number): Promise<ExamAttemptRow | null> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return null;
  const rows = await sql<ExamAttemptRow[]>`
    SELECT *
    FROM exam_attempts
    WHERE exam_id = ${examId} AND student_cid = ${cid}
    ORDER BY id DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listAttemptsForStudent(cid: number): Promise<ExamAttemptRow[]> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return [];
  return await sql<ExamAttemptRow[]>`
    SELECT *
    FROM exam_attempts
    WHERE student_cid = ${cid}
    ORDER BY id DESC
  `;
}

export async function listAttemptsForExam(examId: number, limit = 50): Promise<ExamAttemptRow[]> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return [];
  return await sql<ExamAttemptRow[]>`
    SELECT *
    FROM exam_attempts
    WHERE exam_id = ${examId}
    ORDER BY id DESC
    LIMIT ${limit}
  `;
}

// -----------------------------
// Student-facing exam lists
// -----------------------------

export type StudentAssignedExamItem = {
  exam: ExamRow;
  expiry_date: string;
  latestAttempt: ExamAttemptRow | null;
};

export type StudentCompletedExamItem = {
  exam: ExamRow;
  latestAttempt: ExamAttemptRow;
};

export async function isExamAssignedToStudent(examId: number, cid: number): Promise<boolean> {
  const ok = await tableExists('exam_assignments');
  if (!ok) return false;
  const rows = await sql<any[]>`
    SELECT 1
    FROM exam_assignments
    WHERE exam_id = ${examId} AND controller_cid = ${cid} AND expiry_date >= NOW()
    LIMIT 1
  `;
  return Boolean(rows?.length);
}

export async function listAssignedExamsForStudent(cid: number): Promise<StudentAssignedExamItem[]> {
  const ok = await tableExists('exam_assignments');
  if (!ok) return [];

  const assignments = await sql<Array<{ exam_id: number; expiry_date: any }>>`
    SELECT a.exam_id, a.expiry_date
    FROM exam_assignments a
    WHERE a.controller_cid = ${cid}
      AND (a.expiry_date IS NULL OR a.expiry_date >= CURRENT_DATE())
    ORDER BY a.exam_id ASC
  `;

  const examIds = Array.from(new Set((assignments ?? []).map((a) => Number(a.exam_id)).filter((n) => Number.isFinite(n) && n > 0)));
  if (!examIds.length) return [];

  const exams = await sql<ExamRow[]>`
    SELECT *
    FROM exams
    WHERE id IN ${sql.in(examIds)}
    ORDER BY title ASC
  `;

  const examMap = new Map<number, ExamRow>();
  for (const e of exams ?? []) examMap.set(Number((e as any).id), e);

  // Latest attempt per exam (if any).
  let latestAttempts: ExamAttemptRow[] = [];
  try {
    latestAttempts = await sql<ExamAttemptRow[]>`
      SELECT a.*
      FROM exam_attempts a
      INNER JOIN (
        SELECT exam_id, MAX(id) AS max_id
        FROM exam_attempts
        WHERE student_cid = ${cid} AND exam_id IN ${sql.in(examIds)}
        GROUP BY exam_id
      ) m
      ON m.exam_id = a.exam_id AND m.max_id = a.id
      ORDER BY a.exam_id ASC, a.id DESC
    `;
  } catch {
    latestAttempts = [];
  }

  const attemptByExam = new Map<number, ExamAttemptRow>();
  for (const a of latestAttempts ?? []) attemptByExam.set(Number((a as any).exam_id), a);

  const out: StudentAssignedExamItem[] = [];
  for (const a of assignments ?? []) {
    const examId = Number(a.exam_id);
    const exam = examMap.get(examId);
    if (!exam) continue;
    out.push({
      exam,
      expiry_date: a.expiry_date ? String(a.expiry_date) : '',
      latestAttempt: attemptByExam.get(examId) ?? null,
    });
  }

  // Sort by expiry (soonest first), then title.
  out.sort((x, y) => {
    const ax = x.expiry_date || '9999-12-31';
    const ay = y.expiry_date || '9999-12-31';
    if (ax < ay) return -1;
    if (ax > ay) return 1;
    return String(x.exam.title ?? '').localeCompare(String(y.exam.title ?? ''));
  });
  return out;
}

export async function listCompletedExamsForStudent(cid: number): Promise<StudentCompletedExamItem[]> {
  const ok = await tableExists('exam_attempts');
  if (!ok) return [];

  // Latest non-in-progress attempt per exam.
  const latest = await sql<Array<{ exam_id: number; latest_id: number }>>`
    SELECT exam_id, MAX(id) AS latest_id
    FROM exam_attempts
    WHERE student_cid = ${cid} AND status IN ('graded', 'needs_review')
    GROUP BY exam_id
  `;

  const latestIds = Array.from(new Set((latest ?? []).map((r) => Number(r.latest_id)).filter(Boolean)));
  if (!latestIds.length) return [];

  const attempts = await sql<ExamAttemptRow[]>`
    SELECT *
    FROM exam_attempts
    WHERE id IN ${sql.in(latestIds)}
  `;

  const examIds = Array.from(new Set((attempts ?? []).map((a) => Number((a as any).exam_id)).filter(Boolean)));
  const exams = await Promise.all(examIds.map((id) => getExamById(id)));
  const examMap = new Map<number, ExamRow>();
  for (const e of exams) if (e && e.id != null) examMap.set(Number(e.id), e);

  const out: StudentCompletedExamItem[] = [];
  for (const a of attempts ?? []) {
    const eid = Number((a as any).exam_id);
    const exam = examMap.get(eid);
    if (!exam) continue;
    out.push({ exam, latestAttempt: a });
  }

  // Sort newest first.
  out.sort((a, b) => {
    const ad = String((a.latestAttempt as any).reviewed_at ?? (a.latestAttempt as any).submitted_at ?? (a.latestAttempt as any).updated_at ?? '');
    const bd = String((b.latestAttempt as any).reviewed_at ?? (b.latestAttempt as any).submitted_at ?? (b.latestAttempt as any).updated_at ?? '');
    if (ad > bd) return -1;
    if (ad < bd) return 1;
    return Number((b.latestAttempt as any).id) - Number((a.latestAttempt as any).id);
  });
  return out;
}

// -----------------------------
// Corrections (optional table)
// -----------------------------

export type ExamCorrectionStatus = 'pending' | 'approved' | 'rejected' | string;

export type ExamCorrectionRow = {
  id: number;
  attempt_id: number;
  question_id: number;

  // Helpful denormalized fields some schemas include (safe optional).
  exam_id?: number | null;
  exam_title?: string | null;
  student_cid?: number | null;
  student_name?: string | null;
  attempt_status?: string | null;

  // Student's proposed fix / evidence.
  proposed_choice_id?: number | null; // MCQ: propose a different choice
  proposed_text?: string | null; // Written: proposed corrected text
  reasoning?: string | null;
  proof_url?: string | null;
  proof_text?: string | null;

  // Request + review metadata.
  requested_by_cid: number | null;
  reason: string | null;
  status: ExamCorrectionStatus;
  points_awarded: number | null;
  mentor_note?: string | null; // some schemas name the reviewer note this
  reviewer_comment: string | null;
  reviewed_by_cid: number | null;
  reviewed_at?: string | null;

  created_at: string | null;
  updated_at: string | null;
};

export async function examCorrectionsEnabled(): Promise<boolean> {
  return await tableExists('exam_corrections');
}

export async function createCorrectionRequest(args: {
  attemptId: number;
  questionId: number;
  requestedByCid?: number | null;
  // Stored/compat: some callers use "reason" instead of "reasoning".
  reason?: string | null;
  reasoning?: string | null;
  proposedChoiceId?: number | null;
  proposedText?: string | null;
  proofUrl?: string | null;
  proofText?: string | null;
}): Promise<ExamCorrectionRow | null> {
  const ok = await tableExists('exam_corrections');
  if (!ok) return null;

  const attemptId = Number(args.attemptId);
  const questionId = Number(args.questionId);
  if (!Number.isFinite(attemptId) || attemptId <= 0) throw new Error('Invalid attemptId');
  if (!Number.isFinite(questionId) || questionId <= 0) throw new Error('Invalid questionId');

  // De-dupe: if a request already exists for the same attempt/question, return it (some schemas enforce uniqueness).
  const existing = await sql<ExamCorrectionRow[]>`
    SELECT *
    FROM exam_corrections
    WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
    ORDER BY id DESC
    LIMIT 1
  `;
  if (existing?.length) return existing[0];

  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error('Attempt not found');

  const requestedByCid = args.requestedByCid != null ? Number(args.requestedByCid) : null;
  const reasoning = (args.reasoning ?? args.reason ?? '').toString().trim() || null;
  const proposedChoiceId = args.proposedChoiceId != null ? Number(args.proposedChoiceId) : null;
  const proposedText = args.proposedText != null ? String(args.proposedText) : null;
  const proofUrl = args.proofUrl != null ? String(args.proofUrl) : null;
  const proofText = args.proofText != null ? String(args.proofText) : null;

  const record: any = {
    attempt_id: attemptId,
    question_id: questionId,
    status: 'pending',

    // Who requested it (student).
    requested_by_cid: requestedByCid ?? Number(attempt.student_cid),

    // Student metadata (newer schemas).
    student_cid: Number(attempt.student_cid),
    student_name: attempt.student_name ?? null,

    // Proposed fix / evidence (newer schemas).
    proposed_choice_id: proposedChoiceId,
    proposed_text: proposedText,
    reasoning: reasoning,
    proof_url: proofUrl,
    proof_text: proofText,

    // Stored column name used by older schemas.
    reason: reasoning,
  };

  // insertDynamic will omit fields that don't exist in the target schema.
  const inserted = await insertDynamic('exam_corrections', record).catch(() => null);
  if (inserted) return inserted as ExamCorrectionRow;

  const rows = await sql<ExamCorrectionRow[]>`
    SELECT *
    FROM exam_corrections
    WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
    ORDER BY id DESC
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}

export async function getCorrectionById(correctionId: number): Promise<ExamCorrectionRow | null> {
  const ok = await tableExists('exam_corrections');
  if (!ok) return null;
  const id = Number(correctionId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const rows = await sql<ExamCorrectionRow[]>`
    SELECT *
    FROM exam_corrections
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}

export async function listPendingCorrections(limit = 200): Promise<any[]> {
  const ok = await tableExists('exam_corrections');
  if (!ok) return [];

  // Join attempts/exams for the queue page.
  const rows = await sql<any[]>`
    SELECT
      c.*,
      a.exam_id AS exam_id,
      a.student_cid AS student_cid,
      a.student_name AS student_name,
      a.status AS attempt_status,
      e.title AS exam_title
    FROM exam_corrections c
    LEFT JOIN exam_attempts a ON a.id = c.attempt_id
    LEFT JOIN exams e ON e.id = a.exam_id
    WHERE c.status = 'pending'
    ORDER BY (c.created_at IS NULL) ASC, c.created_at ASC, c.id ASC
    LIMIT ${Math.max(1, Math.min(1000, Number(limit) || 200))}
  `;
  return rows as any;
}

export async function reviewCorrection(args: {
  correctionId: number;
  reviewedByCid: number;
  status: 'approved' | 'rejected';
  pointsAwarded?: number | null;
  reviewerComment?: string | null;
}): Promise<ExamCorrectionRow | null> {
  const ok = await tableExists('exam_corrections');
  if (!ok) return null;

  const id = Number(args.correctionId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('Invalid correctionId');

  const status = args.status === 'approved' ? 'approved' : 'rejected';
  const reviewedByCid = Number(args.reviewedByCid);
  const points = args.pointsAwarded == null ? null : Number(args.pointsAwarded);
  const comment = (args.reviewerComment ?? '').toString().trim() || null;

  await sql`
    UPDATE exam_corrections
    SET status = ${status},
        points_awarded = ${points},
        reviewer_comment = ${comment},
        reviewed_by_cid = ${reviewedByCid},
        updated_at = NOW()
    WHERE id = ${id}
  `;

  return await getCorrectionById(id);
}
