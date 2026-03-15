import Link from 'next/link';
import PageShell from '@/components/PageShell';
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import { requireFeedbackModerator } from '@/lib/auth/guards';
import { getFeedbackById, type FeedbackStatus } from '@/lib/feedback';
import { setFeedbackStatusAction } from '../actions';

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

export default async function AdminFeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeedbackModerator();
  const { id } = await params;
  const fid = Number.parseInt(id, 10);

  const fb = Number.isFinite(fid) ? await getFeedbackById(fid) : null;

  if (!fb) {
    return (
      <PageShell
        title="Feedback"
        subtitle="Not found"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/feedback', label: 'Feedback' }, { label: 'Not found' }]}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <p className="text-sm text-white/70">Feedback entry not found.</p>
            <div className="mt-4">
              <Link href="/admin/feedback" className="ui-btn">Back</Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const status = (fb.status ?? 'pending') as FeedbackStatus;
  const created = fb.created_at ? new Date(fb.created_at).toLocaleString() : '—';
  const controller = `${asText(fb.controller_name) || '—'}${asText(fb.controller_cid) ? ` (CID ${asText(fb.controller_cid)})` : ''}`;
  const pilot = `${asText(fb.pilot_name) || '—'}${asText(fb.pilot_cid) ? ` (CID ${asText(fb.pilot_cid)})` : ''}`;
  const pos = POS_LABEL[asText(fb.pos_category)] ?? asText(fb.pos_category) ?? '—';
  const rating = asText(fb.service_level) || '—';

  return (
    <PageShell
      title={`Feedback #${asText(fb.id)}`}
      subtitle="Review and moderate pilot feedback."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/feedback', label: 'Feedback' }, { label: `#${asText(fb.id)}` }]}
      right={<Link href="/admin/feedback" className="ui-btn">Back</Link>}
    >
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="flex items-center gap-2">
            {statusBadge(status)}
            <span className="text-xs text-white/60">Submitted {created}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={setFeedbackStatusAction}>
              <input type="hidden" name="id" value={String(fb.id)} />
              <input type="hidden" name="status" value="approved" />
              <input type="hidden" name="return_status" value="all" />
              <button type="submit" className="ui-btn ui-btn--primary">Approve</button>
            </form>
            <form action={setFeedbackStatusAction}>
              <input type="hidden" name="id" value={String(fb.id)} />
              <input type="hidden" name="status" value="pending" />
              <input type="hidden" name="return_status" value="all" />
              <button type="submit" className="ui-btn">Pending</button>
            </form>
            <form action={setFeedbackStatusAction}>
              <input type="hidden" name="id" value={String(fb.id)} />
              <input type="hidden" name="status" value="rejected" />
              <input type="hidden" name="return_status" value="all" />
              <ConfirmSubmitButton type="submit" className="ui-btn ui-btn--danger" confirmMessage="Reject this feedback?">Reject</ConfirmSubmitButton>
            </form>
          </div>
        </div>

        <div className="ui-card__body">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60">Controller</div>
              <div className="text-sm font-semibold text-white/85">{controller}</div>
              <div className="mt-1 text-xs text-white/60">Email: {asText(fb.controller_email) || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Pilot</div>
              <div className="text-sm font-semibold text-white/85">{pilot}</div>
              <div className="mt-1 text-xs text-white/60">Email: {asText(fb.pilot_email) || '—'}</div>
            </div>
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
              {asText(fb.comments) || '—'}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
