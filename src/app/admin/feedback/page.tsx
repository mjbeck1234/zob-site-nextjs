import Link from 'next/link';
import PageShell from '@/components/PageShell';
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import { requireFeedbackModerator } from '@/lib/auth/guards';
import { listFeedback, type FeedbackStatus, type FeedbackRow } from '@/lib/feedback';
import { setFeedbackStatusAction } from './actions';

const STATUS_TABS: Array<{ key: 'all' | FeedbackStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const POS_LABEL: Record<string, string> = {
  DEL: 'Clearance Delivery',
  GND: 'Ground Control',
  TWR: 'Local Control (Tower)',
  APP: 'TRACON (Approach/Departure)',
  CTR: 'Enroute (Center)',
};

function asText(v: any): string {
  return String(v ?? '').trim();
}

function statusBadge(status: FeedbackStatus) {
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold';
  if (status === 'approved') return <span className={`${base} border-emerald-500/30 bg-emerald-500/15 text-emerald-100`}>Approved</span>;
  if (status === 'rejected') return <span className={`${base} border-rose-500/30 bg-rose-500/15 text-rose-100`}>Rejected</span>;
  return <span className={`${base} border-white/15 bg-white/5 text-white/80`}>Pending</span>;
}

function snippet(s: string, n = 110) {
  const t = asText(s);
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + '…';
}

function normTab(v: any): 'all' | FeedbackStatus {
  const s = asText(v).toLowerCase();
  if (s === 'pending' || s === 'approved' || s === 'rejected') return s;
  return 'all';
}

function createdLabel(row: FeedbackRow) {
  const raw = row.created_at ?? row.createdAt;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireFeedbackModerator();
  const sp = await searchParams;

  const tab = normTab(Array.isArray(sp.status) ? sp.status[0] : sp.status);
  const saved = (Array.isArray(sp.saved) ? sp.saved[0] : sp.saved) === '1';
  const error = (Array.isArray(sp.error) ? sp.error[0] : sp.error) === 'invalid';

  const rows = await listFeedback({ status: tab === 'all' ? 'all' : tab, limit: 250 });

  return (
    <PageShell
      title="Feedback Moderation"
      subtitle="Approve, reject, or return feedback to pending."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'Feedback' }]}
      right={<Link className="ui-btn" href="/feedback">Pilot form</Link>}
    >
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/feedback?status=${t.key}`}
            className={
              t.key === tab
                ? 'ui-btn ui-btn--primary'
                : 'ui-btn'
            }
          >
            {t.label}
          </Link>
        ))}
        {saved ? <span className="ui-badge">Saved</span> : null}
        {error ? <span className="ui-badge">Invalid</span> : null}
      </div>

      <div className="mt-4 ui-card">
        <div className="ui-card__header">
          <div>
            <div className="text-sm font-semibold">Feedback Entries</div>
            <div className="text-xs text-white/60">Only admins can change status.</div>
          </div>
          <div className="text-xs text-white/60">{rows.length} shown</div>
        </div>

        <div className="ui-card__body">
          {rows.length === 0 ? (
            <div className="text-sm text-white/70">No feedback found.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const id = Number(r.id);
                const status = (r.status ?? 'pending') as FeedbackStatus;
                const controller = `${asText(r.controller_name) || '—'}${asText(r.controller_cid) ? ` (CID ${asText(r.controller_cid)})` : ''}`;
                const pilot = `${asText(r.pilot_name) || '—'}${asText(r.pilot_cid) ? ` (CID ${asText(r.pilot_cid)})` : ''}`;
                const pos = POS_LABEL[asText(r.pos_category)] ?? asText(r.pos_category) ?? '—';
                const rating = asText(r.service_level) || '—';

                return (
                  <div key={String(r.id)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {statusBadge(status)}
                        <Link href={`/admin/feedback/${id}`} className="ui-link text-sm font-semibold">
                          #{id}
                        </Link>
                        <span className="text-xs text-white/55">{createdLabel(r)}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <form action={setFeedbackStatusAction}>
                          <input type="hidden" name="id" value={String(id)} />
                          <input type="hidden" name="status" value="approved" />
                          <input type="hidden" name="return_status" value={tab} />
                          <button type="submit" className="ui-btn ui-btn--primary">Approve</button>
                        </form>
                        <form action={setFeedbackStatusAction}>
                          <input type="hidden" name="id" value={String(id)} />
                          <input type="hidden" name="status" value="pending" />
                          <input type="hidden" name="return_status" value={tab} />
                          <button type="submit" className="ui-btn">Pending</button>
                        </form>
                        <form action={setFeedbackStatusAction}>
                          <input type="hidden" name="id" value={String(id)} />
                          <input type="hidden" name="status" value="rejected" />
                          <input type="hidden" name="return_status" value={tab} />
                          <ConfirmSubmitButton
                            type="submit"
                            className="ui-btn ui-btn--danger"
                            confirmMessage="Reject this feedback?"
                          >
                            Reject
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="text-sm">
                        <div className="text-white/60 text-xs">Controller</div>
                        <div className="text-white/85 font-semibold">{controller}</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-white/60 text-xs">Pilot</div>
                        <div className="text-white/85 font-semibold">{pilot}</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-white/60 text-xs">Position</div>
                        <div className="text-white/85 font-semibold">{pos}</div>
                      </div>
                      <div className="text-sm">
                        <div className="text-white/60 text-xs">Rating</div>
                        <div className="text-white/85 font-semibold">{rating}</div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-white/80">
                      {snippet(asText(r.comments))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
