import PageShell from '@/components/PageShell';
import { requireExamsManager } from '@/lib/auth/guards';
import { sql } from '@/lib/db';
import { assignExamAction } from './actions';

function displayName(row: any) {
  const pref = (row?.pref_name ?? '').toString().trim();
  if (pref) return pref;
  const first = (row?.first_name ?? '').toString().trim();
  const last = (row?.last_name ?? '').toString().trim();
  const full = `${first} ${last}`.trim();
  return full || `CID ${row?.cid}`;
}

export default async function AssignExamPage() {
  await requireExamsManager();

  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const exams: any[] = await sql`SELECT id, title FROM exams ORDER BY title`;

  // Controllers dropdown:
  // - "Home" controllers: active roster members
  // - "Visiting" controllers: approved visitors in visit table
  // Sort: last name DESC (then first name DESC)
  const rosterHome: any[] = await sql`
    SELECT cid, pref_name, first_name, last_name
    FROM roster
    WHERE active = 'Yes' AND status = 'a'
  `;

  const visitors: any[] = await sql`
    SELECT cid, '' AS pref_name, first_name, last_name
    FROM visit
    WHERE approved IN ('Yes', '1', 'true', 'TRUE', 'Y')
  `;

  // Deduplicate by CID (prefer roster row if present)
  const byCid = new Map<string, any>();
  for (const r of visitors) byCid.set(String(r.cid), r);
  for (const r of rosterHome) byCid.set(String(r.cid), r);

  const controllers = Array.from(byCid.values()).sort((a, b) => {
    const al = String(a.last_name ?? '');
    const bl = String(b.last_name ?? '');
    const af = String(a.first_name ?? '');
    const bf = String(b.first_name ?? '');
    const ln = bl.localeCompare(al);
    if (ln !== 0) return ln;
    return bf.localeCompare(af);
  });

  return (
    <PageShell title="Assign Exam" subtitle="Assign an exam to a controller">
      <form action={assignExamAction} className="ui-card ui-card__body grid gap-3 max-w-xl">
        <label className="grid gap-1">
          <span>Exam</span>
          <select name="exam_id" className="ui-input" required defaultValue="">
            <option value="" disabled>Select an exam…</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} (#{e.id})
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span>Controller</span>
          <select name="controller_cid" className="ui-input" required defaultValue="">
            <option value="" disabled>Select a controller…</option>
            {controllers.map((r) => (
              <option key={r.cid} value={r.cid}>
                {displayName(r)} ({r.cid})
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span>Expiry date</span>
          <input type="date" name="expiry_date" defaultValue={defaultExpiry} className="ui-input" />
        </label>

        <button className="ui-btn ui-btn--primary">Assign</button>
      </form>
    </PageShell>
  );
}
