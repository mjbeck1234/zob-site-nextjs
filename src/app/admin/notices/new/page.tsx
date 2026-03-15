import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { createNoticeAction } from '../actions';

export default async function NewNoticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const error = sp?.error;

  return (
    <PageShell
      title="Admin • New Notice"
      subtitle="Post a notice to the site."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/notices', label: 'Notices' }, { label: 'New' }]}
      right={(
        <Link href="/admin/notices" className="ui-button">
          Back
        </Link>
      )}
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Please enter a title or body.</div>
      ) : null}

      <form action={createNoticeAction} className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Notice details</div>
        </div>
        <div className="ui-card__body space-y-4">
          <label className="block">
            <div className="text-xs text-white/60 mb-1">Title</div>
            <input name="title" className="ui-input" placeholder="Short headline" />
          </label>

          <label className="block">
            <div className="text-xs text-white/60 mb-1">Body</div>
            <textarea name="body" className="ui-textarea" placeholder="Full notice text" />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="published" defaultChecked />
              Published
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="archived" />
              Archived
            </label>
          </div>

          <button className="ui-button" type="submit">
            Create notice
          </button>
        </div>
      </form>
    </PageShell>
  );
}
