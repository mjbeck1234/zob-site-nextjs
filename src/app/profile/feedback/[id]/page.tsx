import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { redirect } from 'next/navigation';
import { requireLogin } from '@/lib/auth/guards';
import { canModerateFeedback } from '@/lib/auth/feedback';
import { getFeedbackById, type FeedbackStatus } from '@/lib/feedback';

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

export default async function ProfileFeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireLogin();
  const { id } = await params;
  const fid = Number.parseInt(id, 10);
  if (!Number.isFinite(fid)) redirect('/profile/feedback');

  const fb = await getFeedbackById(fid);
  if (!fb) redirect('/profile/feedback');

  const status = (fb.status ?? 'pending') as FeedbackStatus;
  const isAdmin = canModerateFeedback(user);
  const controllerCid = Number.parseInt(asText(fb.controller_cid), 10);

  // Controller can only see approved feedback for themselves.
  if (!isAdmin) {
    if (status !== 'approved') redirect('/profile/feedback');
    if (!Number.isFinite(controllerCid) || controllerCid !== user.cid) redirect('/profile/feedback');
  }

  const created = fb.created_at ? new Date(fb.created_at).toLocaleString() : '—';
  const pos = POS_LABEL[asText(fb.pos_category)] ?? asText(fb.pos_category) ?? '—';
  const rating = asText(fb.service_level) || '—';
  const comments = asText(fb.comments) || '—';

  return (
    <PageShell
      title={`Feedback #${asText(fb.id)}`}
      subtitle="Position, rating, and comments."
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/profile', label: 'Profile' },
        { href: '/profile/feedback', label: 'Feedback' },
        { label: `#${asText(fb.id)}` },
      ]}
      right={<Link href="/profile/feedback" className="ui-btn">Back</Link>}
    >
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="flex items-center gap-2">
            {statusBadge(status)}
            <span className="text-xs text-white/60">Submitted {created}</span>
          </div>
          {isAdmin ? (
            <Link href={`/admin/feedback/${asText(fb.id)}`} className="ui-btn">Open in Admin</Link>
          ) : null}
        </div>

        <div className="ui-card__body">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60">Position</div>
              <div className="text-sm font-semibold text-white/85">{pos}</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Rating</div>
              <div className="text-sm font-semibold text-white/85">{rating}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-white/60 mb-1">Comments</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/85 whitespace-pre-wrap">
              {comments}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
