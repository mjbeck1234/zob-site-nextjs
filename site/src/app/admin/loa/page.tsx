import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireLoaModerator } from '@/lib/auth/guards';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { setLoaRequestStatusAction } from './actions';

type Row = {
  id: number;
  controller_cid: number;
  controller_name: string | null;
  controller_email: string | null;
  estimated_date: string | null;
  reason: string | null;
  approved: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function statusLabel(a: boolean | null): { text: string; badge: string } {
  if (a === null) return { text: 'Pending', badge: 'ui-badge' };
  if (a === true) return { text: 'Approved', badge: 'ui-badge ui-badge--success' };
  return { text: 'Rejected', badge: 'ui-badge ui-badge--danger' };
}

export default async function AdminLoaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; updated?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireLoaModerator();

  const ok = await tableExists('loa_requests').catch(() => false);
  const status = String(sp.status ?? 'pending').toLowerCase();

  const where =
    status === 'approved'
      ? sql`WHERE approved = TRUE`
      : status === 'rejected'
      ? sql`WHERE approved = FALSE`
      : status === 'all'
      ? sql``
      : sql`WHERE approved IS NULL`;

  const rows = ok
    ? await sql<Row[]>`
        SELECT id, controller_cid, controller_name, controller_email, estimated_date, reason, approved, created_at, updated_at
        FROM loa_requests
        ${where}
        ORDER BY (created_at IS NULL) ASC, created_at DESC, id DESC
        LIMIT 250
      `
    : [];

  const returnTo = `/admin/loa?status=${encodeURIComponent(status)}`;

  return (
    <PageShell
      title="LOA Requests"
      subtitle="Senior Staff review queue for Leave of Absence requests."
      crumbs={[{ href: '/admin', label: 'Admin' }, { label: 'LOA' }]}
      right={<Link href="/admin" className="ui-btn">Back</Link>}
    >
      {!ok ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              The <span className="text-white/80 font-semibold">loa_requests</span> table is not present in your DB.
              Run <code className="text-white/80">sql/create_tables_extra.sql</code> to create it.
            </div>
          </div>
        </div>
      ) : (
        <>
          {sp.updated === '1' ? <div className="mb-4 ui-badge ui-badge--success">Updated</div> : null}
          {sp.error ? (
            <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
              {sp.error === 'missing_table' ? 'Missing loa_requests table.' : null}
              {sp.error === 'missing_id' ? 'Missing request id.' : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Link href="/admin/loa?status=pending" className={`ui-btn ${status === 'pending' ? 'ui-btn--primary' : ''}`}>Pending</Link>
            <Link href="/admin/loa?status=approved" className={`ui-btn ${status === 'approved' ? 'ui-btn--primary' : ''}`}>Approved</Link>
            <Link href="/admin/loa?status=rejected" className={`ui-btn ${status === 'rejected' ? 'ui-btn--primary' : ''}`}>Rejected</Link>
            <Link href="/admin/loa?status=all" className={`ui-btn ${status === 'all' ? 'ui-btn--primary' : ''}`}>All</Link>
          </div>

          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Requests</div>
              <span className="text-xs text-white/60">{rows.length} shown</span>
            </div>
            <div className="ui-card__body">
              {!rows.length ? (
                <div className="text-sm text-white/70">No requests.</div>
              ) : (
                <div className="space-y-3">
                  {rows.map((r) => {
                    const st = statusLabel(r.approved);
                    return (
                      <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {r.controller_name ?? 'Controller'} ({r.controller_cid})
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                              Return: {r.estimated_date ? new Date(r.estimated_date).toLocaleDateString() : '—'}
                              <span className="mx-2">•</span>
                              <span className={st.badge}>{st.text}</span>
                            </div>
                            {r.controller_email ? <div className="mt-1 text-xs text-white/55">{r.controller_email}</div> : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <form action={setLoaRequestStatusAction}>
                              <input type="hidden" name="id" value={String(r.id)} />
                              <input type="hidden" name="status" value="approved" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <button className="ui-btn ui-btn--primary" type="submit">Approve</button>
                            </form>
                            <form action={setLoaRequestStatusAction}>
                              <input type="hidden" name="id" value={String(r.id)} />
                              <input type="hidden" name="status" value="rejected" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <button className="ui-btn ui-btn--danger" type="submit">Reject</button>
                            </form>
                            <form action={setLoaRequestStatusAction}>
                              <input type="hidden" name="id" value={String(r.id)} />
                              <input type="hidden" name="status" value="pending" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <button className="ui-btn" type="submit">Pending</button>
                            </form>
                          </div>
                        </div>

                        {r.reason ? <div className="mt-3 text-xs text-white/70 whitespace-pre-wrap">{r.reason}</div> : null}
                        <div className="mt-3 text-xs text-white/50">
                          Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-xs text-white/60">
            Only Senior Staff/Admin can change status. Requests start Pending and must be approved or rejected.
          </div>
        </>
      )}
    </PageShell>
  );
}
