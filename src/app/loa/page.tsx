import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireZobMember } from '@/lib/auth/guards';
import { getLoaRequestsForCid, loaEnabled } from '@/lib/loa';
import { deleteMyLoaRequestAction, submitLoaRequestAction } from './actions';

export default async function LoaPage({ searchParams }: { searchParams: Promise<{ sent?: string; deleted?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await requireZobMember();
  const ok = await loaEnabled();
  const rows = ok ? await getLoaRequestsForCid(user.cid) : [];

  return (
    <PageShell
      title="Leave of Absence"
      subtitle="Request and manage your LOA."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/profile', label: 'Profile' }, { label: 'LOA' }]}
      right={<Link href="/profile" className="ui-btn">Back</Link>}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Request LOA</div>
              <div className="text-xs text-white/60">Minimum 30 days, maximum 90 days (standard).</div>
            </div>
          </div>
          <div className="ui-card__body">
            {!ok ? (
              <div className="text-sm text-white/70">
                The <span className="text-white/80 font-semibold">loa_requests</span> table is not present in your DB.
              </div>
            ) : (
              <>
                {sp.sent === '1' ? <div className="mb-4 ui-badge">Submitted</div> : null}
                {sp.deleted === '1' ? <div className="mb-4 ui-badge">Deleted</div> : null}
                {sp.error ? (
                  <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                    {sp.error === 'missing' ? 'Estimated return date and reason are required.' : null}
                    {sp.error === 'range' ? 'Return date must be 30 to 90 days from today (standard LOA policy).' : null}
                    {sp.error === 'missing_table' ? 'Missing loa_requests table.' : null}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
                  <div className="font-semibold text-white">Before you submit or remove an LOA, please review:</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>The minimum length for a LOA is 30 days and the maximum length is 90 days.</li>
                    <li>A controller may request an extension by resubmitting this form to the ATM/DATM (extension may not exceed 90 days).</li>
                    <li>Active-duty military may be permitted up to 24 months for deployments/duties; returning personnel require a checkout.</li>
                    <li>If a controller on LOA logs into the network to control, it will automatically end their LOA.</li>
                  </ul>
                </div>

                <form action={submitLoaRequestAction} className="mt-4 grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Estimated Date of Return</span>
                    <input type="date" name="estimated_date" className="ui-input" required />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Reason</span>
                    <textarea name="reason" className="ui-input min-h-[140px]" placeholder="Why are you requesting an LOA?" required />
                  </label>
                  <button className="ui-btn ui-btn--primary" type="submit">Submit LOA Request</button>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Your Requests</div>
              <div className="text-xs text-white/60">Most recent first</div>
            </div>
          </div>
          <div className="ui-card__body">
            {!rows.length ? (
              <div className="text-sm text-white/70">No requests.</div>
            ) : (
              <div className="space-y-3">
                {rows.slice(0, 10).map((r) => (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Return: {r.estimated_date ? new Date(r.estimated_date).toLocaleDateString() : '—'}</div>
                        <div className="mt-1 text-xs text-white/60">
                          Status: {r.approved === null ? 'Pending' : r.approved ? 'Approved' : 'Rejected'}
                        </div>
                      </div>
                      {r.approved === true ? null : (
                        <form action={deleteMyLoaRequestAction.bind(null, String(r.id))}>
                          <button className="ui-btn ui-btn--danger" type="submit">Remove</button>
                        </form>
                      )}
                    </div>
                    {r.reason ? <div className="mt-3 text-xs text-white/70 whitespace-pre-wrap">{r.reason}</div> : null}
                    <div className="mt-3 text-xs text-white/50">Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </PageShell>
  );
}
