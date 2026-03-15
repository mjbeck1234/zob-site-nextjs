import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireTrainingTicketsManager } from '@/lib/auth/guards';
import { canViewAllTrainingTickets } from '@/lib/auth/trainingTickets';
import { getRoster } from '@/lib/content';
import { getTrainingTicketsSchemaInfo, listTrainingTickets, listTrainingTicketsForMentor, getTrainingTicketStats, getTrainingTicketStatsForMentor } from '@/lib/trainingTickets';

function nameOf(r: any) {
  const first = String(r?.pref_name ?? r?.first_name ?? '').trim();
  const last = String(r?.last_name ?? '').trim();
  const cid = r?.cid ? ` (#${r.cid})` : '';
  const base = `${first} ${last}`.trim();
  return (base || 'Unknown') + cid;
}

function formatWhen(v: any) {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-xs text-white/70">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-2 bg-white/40" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 text-right text-xs text-white/70">{value}</div>
    </div>
  );
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

export default async function AdminTrainingTicketsPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const actor = await requireTrainingTicketsManager();
  const canViewAll = canViewAllTrainingTickets(actor);

  const schema = await getTrainingTicketsSchemaInfo();

  const roster = (await getRoster()) as any[];
  const rosterByCid: Record<string, any> = {};
  for (const r of roster) rosterByCid[String(r.cid)] = r;

  const tickets = canViewAll ? await listTrainingTickets(250) : await listTrainingTicketsForMentor(actor.cid, 250);
  const stats = canViewAll ? await getTrainingTicketStats(12) : await getTrainingTicketStatsForMentor(actor.cid, 12);

  const saved = typeof sp.saved === 'string' ? sp.saved === '1' : false;
  const deleted = typeof sp.deleted === 'string' ? sp.deleted === '1' : false;
  const error = typeof sp.error === 'string' ? sp.error : '';

  const perMonth = (stats.perMonth ?? []).slice(-6);
  const perMonthMax = Math.max(0, ...perMonth.map((r) => Number(r.count) || 0));

  const byType = (stats.byType ?? []).slice(0, 8);
  const byTypeMax = Math.max(0, ...byType.map((r) => Number(r.count) || 0));

  // Per mentor, last month
  const lastMonth = perMonth.length ? perMonth[perMonth.length - 1]?.month : null;
  const perMentorRows = (stats.perMentorMonth ?? []).filter((r) => (lastMonth ? String(r.month) === String(lastMonth) : true));
  const perMentorTop = perMentorRows
    .slice()
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
    .slice(0, 8)
    .map((r) => ({
      label: rosterByCid[String(r.mentor_cid)] ? nameOf(rosterByCid[String(r.mentor_cid)]).replace(/ \(#\d+\)$/, '') : `CID ${r.mentor_cid}`,
      count: Number(r.count) || 0,
    }));
  const perMentorMax = Math.max(0, ...perMentorTop.map((r) => r.count));

  return (
    <PageShell
      title="Admin • Training Tickets"
      subtitle="Record training sessions and review basic stats (counts only)."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Training Tickets' }]}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/learning" className="ui-btn">Back</Link>
          <Link href="/admin/training-tickets/new" className="ui-btn ui-btn--primary">
            New ticket
          </Link>
        </div>
      }
    >
      {saved ? (
        <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          Training ticket saved.
        </div>
      ) : null}

      {deleted ? (
        <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          Training ticket deleted.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          {error === 'not_found'
            ? 'Training ticket not found.'
            : error === 'db_migrate'
              ? 'DB schema missing required columns. Run the training tickets migration SQL and refresh.'
              : 'Something went wrong.'}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold text-white">Sessions per month</div>
            <span className="ui-badge">Last 6</span>
          </div>
          <div className="ui-card__body space-y-2">
            {perMonth.length ? (
              perMonth.map((r) => <BarRow key={r.month} label={String(r.month)} value={Number(r.count) || 0} max={perMonthMax} />)
            ) : (
              <div className="text-sm text-white/60">No data yet.</div>
            )}
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold text-white">Sessions by mentor</div>
            <span className="ui-badge">{lastMonth ?? 'Recent'}</span>
          </div>
          <div className="ui-card__body space-y-2">
            {perMentorTop.length ? (
              perMentorTop.map((r) => <BarRow key={r.label} label={r.label} value={r.count} max={perMentorMax} />)
            ) : (
              <div className="text-sm text-white/60">No data yet.</div>
            )}
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold text-white">Session types</div>
            <span className="ui-badge">Last 12</span>
          </div>
          <div className="ui-card__body space-y-2">
            {byType.length ? (
              byType.map((r) => (
                <BarRow
                  key={String(r.session_type)}
                  label={String(r.session_type).replaceAll('_', ' ')}
                  value={Number(r.count) || 0}
                  max={byTypeMax}
                />
              ))
            ) : (
              <div className="text-sm text-white/60">No data yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="ui-card mt-4">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Recent tickets</div>
          <span className="ui-badge">{tickets.length}</span>
        </div>
        <div className="ui-card__body overflow-x-auto">
          {!tickets.length ? (
            <div className="text-sm text-white/60">No tickets yet.</div>
          ) : (
            <table className="ui-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Student</th>
                  <th>Mentor</th>
                  <th>Type</th>
                  <th>Minutes</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t: any) => {
                  const student = rosterByCid[String(t.student_cid)];
                  const mentor = rosterByCid[String(t.mentor_cid)];
                  const noShow = schema.hasNoShow ? toBool(t.no_show) : false;
                  return (
                    <tr key={String(t.id)}>
                      <td>
                        <Link href={`/admin/training-tickets/${encodeURIComponent(String(t.id))}`} className="ui-link">
                          {formatWhen(t.session_start)}
                        </Link>
                      </td>
                      <td>{student ? nameOf(student) : `CID ${t.student_cid}`}</td>
                      <td>{mentor ? nameOf(mentor) : `CID ${t.mentor_cid}`}</td>
                      <td>{String(t.session_type ?? '').replaceAll('_', ' ')}</td>
                      <td>{Number(t.duration_minutes) || 0}</td>
                      <td>{noShow ? <span className="ui-badge">No-show</span> : <span className="text-white/60">—</span>}</td>
                      <td className="max-w-[420px] truncate" title={t.notes ? String(t.notes) : ''}>
                        {t.notes ? String(t.notes) : ''}
                      </td>
                      <td className="text-right">
                        <Link href={`/admin/training-tickets/${encodeURIComponent(String(t.id))}`} className="ui-btn">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {!schema.table ? (
        <div className="mt-3 text-xs text-white/50">
          DB required: run{' '}
          <code className="px-1 py-0.5 rounded bg-white/10">sql/create_tables_training_tickets.sql</code>.
        </div>
      ) : !schema.hasRubric ? (
        <div className="mt-3 text-xs text-white/50">
          DB update required: run{' '}
          <code className="px-1 py-0.5 rounded bg-white/10">sql/alter_training_tickets_rubric.sql</code>.
        </div>
      ) : null}
    </PageShell>
  );
}
