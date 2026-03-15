import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { getById } from '@/lib/admin/crud';
import { deleteDownloadAction, updateDownloadAction } from '../actions';

export default async function EditDownloadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const saved = (sp?.saved ?? '') === '1';

  const d = await getById('downloads', id);
  if (!d) {
    return (
      <PageShell title="Admin • Download" subtitle="Download not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/downloads', label: 'Downloads' }, { label: String(id) }]}>
        <div className="ui-card"><div className="ui-card__body text-sm text-white/70">Download not found.</div></div>
      </PageShell>
    );
  }

  const update = updateDownloadAction.bind(null, String(id));

  return (
    <PageShell
      title="Admin • Edit Download"
      subtitle={`Editing download #${id}`}
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/downloads', label: 'Downloads' }, { label: String(id) }]}
      right={(
        <div className="flex items-center gap-2">
          <Link href="/admin/downloads" className="ui-button">Back</Link>
          <form action={deleteDownloadAction.bind(null, String(id))}>
            <button className="ui-button danger" type="submit">Delete</button>
          </form>
        </div>
      )}
    >
      {saved ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Saved.</div>
      ) : null}

      <form action={update} className="ui-card">
        <div className="ui-card__header"><div className="text-sm font-semibold">Download</div></div>
        <div className="ui-card__body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Name</div>
              <input name="name" className="ui-input" defaultValue={String(d.name ?? d.title ?? '')} />
            </label>
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Category</div>
              <input name="category" className="ui-input" defaultValue={String(d.category ?? '')} />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">File path / URL</div>
              <input name="file_path" className="ui-input" defaultValue={String(d.file_path ?? d.url ?? '')} />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Upload date (YYYY-MM-DD)</div>
              <input name="upload_date" className="ui-input" defaultValue={String(d.upload_date ?? '')} />
            </label>
          </div>

          <label className="block">
            <div className="text-xs text-white/60 mb-1">Description</div>
            <textarea name="description" className="ui-textarea" defaultValue={String(d.description ?? '')} />
          </label>

          <button className="ui-button" type="submit">Save changes</button>
        </div>
      </form>

      <div className="mt-4 text-xs text-white/55">Stored columns depend on your DB schema. This editor will only update columns that exist.</div>
    </PageShell>
  );
}
