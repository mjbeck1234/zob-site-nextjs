import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/guards';
import { listApprovedFeedbackForControllerCid } from '@/lib/feedback';

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

export default async function ProfileFeedbackPage() {
  const user = await requireLogin();
  const rows = await listApprovedFeedbackForControllerCid(user.cid);

  return (
    <PageShell
      title="Feedback"
      subtitle="Approved feedback you've received."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/profile', label: 'Profile' }, { label: 'Feedback' }]}
      right={<Link href="/profile" className="ui-btn">Back</Link>}
    >
      <div className="ui-card">
        <div className="ui-card__header">
          <div>
            <div className="text-sm font-semibold">Approved Feedback</div>
            <div className="text-xs text-white/60">
              Only the position, rating, and comments are shown here.
            </div>
          </div>
          <div className="text-xs text-white/60">{rows.length} total</div>
        </div>

        <div className="ui-card__body">
          {rows.length === 0 ? (
            <div className="text-sm text-white/70">No approved feedback yet.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const id = Number(r.id);
                const created = r.created_at ? new Date(r.created_at).toLocaleString() : '—';
                const pos = POS_LABEL[asText(r.pos_category)] ?? asText(r.pos_category) ?? '—';
                const rating = asText(r.service_level) || '—';
                const comments = asText(r.comments);

                return (
                  <Link
                    key={String(r.id)}
                    href={`/profile/feedback/${id}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 p-4 no-underline hover:opacity-95 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white/85">{pos}</div>
                      <div className="text-xs text-white/60">{created}</div>
                    </div>

                    <div className="mt-2 text-sm">
                      <div className="text-xs text-white/60">Rating</div>
                      <div className="text-white/85 font-semibold">{rating}</div>
                    </div>

                    <div className="mt-2 text-sm text-white/70">
                      {comments.slice(0, 140)}{comments.length > 140 ? '…' : ''}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
