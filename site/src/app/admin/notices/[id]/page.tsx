import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { getById } from '@/lib/admin/crud';
import { deleteNoticeAction, updateNoticeAction } from '../actions';

export default async function EditNoticePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const saved = (sp?.saved ?? '') === '1';

  const notice = await getById('notices', id);
  if (!notice) {
    return (
      <PageShell title="Admin • Notice" subtitle="Notice not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/notices', label: 'Notices' }, { label: String(id) }]}>
        <div className="ui-card">
          <div className="ui-card__body text-sm text-white/70">
            Notice not found.
          </div>
        </div>
      </PageShell>
    );
  }

  const update = updateNoticeAction.bind(null, String(id));

  return (
    <PageShell
      title="Admin • Edit Notice"
      subtitle={`Editing notice #${id}`}
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/notices', label: 'Notices' }, { label: String(id) }]}
      right={(
        <div className="flex items-center gap-2">
          <Link href="/admin/notices" className="ui-button">
            Back
          </Link>
          <form action={deleteNoticeAction.bind(null, String(id))}>
            <button className="ui-button danger" type="submit">
              Delete
            </button>
          </form>
        </div>
      )}
    >
      {saved ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Saved.</div>
      ) : null}

      <form action={update} className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Notice</div>
        </div>
        <div className="ui-card__body space-y-4">
          <label className="block">
            <div className="text-xs text-white/60 mb-1">Title</div>
            <input name="title" className="ui-input" defaultValue={String(notice.title ?? '')} />
          </label>

          <label className="block">
            <div className="text-xs text-white/60 mb-1">Body</div>
            <textarea name="body" className="ui-textarea" defaultValue={String(notice.body ?? '')} />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="published" defaultChecked={Boolean(notice.published ?? true)} />
              Published
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="archived" defaultChecked={Boolean(notice.archived ?? false)} />
              Archived
            </label>
          </div>

          <button className="ui-button" type="submit">
            Save changes
          </button>
        </div>
      </form>

      <div className="mt-4 text-xs text-white/55">
        Stored columns depend on your DB schema. This editor will only update columns that exist.
      </div>
    </PageShell>
  );
}
