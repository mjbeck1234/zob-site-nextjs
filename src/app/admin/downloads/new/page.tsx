import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { createDownloadAction } from '../actions';

export default async function NewDownloadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const error = sp?.error;

  return (
    <PageShell
      title="Admin • New Download"
      subtitle="Add a download link/file entry."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/downloads', label: 'Downloads' }, { label: 'New' }]}
      right={(
        <Link href="/admin/downloads" className="ui-button">Back</Link>
      )}
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">Please enter a file path / URL.</div>
      ) : null}

      <form action={createDownloadAction} className="ui-card">
        <div className="ui-card__header"><div className="text-sm font-semibold">Download details</div></div>
        <div className="ui-card__body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Name</div>
              <input name="name" className="ui-input" placeholder="e.g. ZOB SOP PDF" />
            </label>
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Category</div>
              <input name="category" className="ui-input" placeholder="SOP / Training / Tools" />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">File path / URL</div>
              <input name="file_path" className="ui-input" placeholder="/files/sop.pdf or https://..." />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Upload date (YYYY-MM-DD)</div>
              <input name="upload_date" className="ui-input" placeholder="2026-01-12" />
            </label>
          </div>

          <label className="block">
            <div className="text-xs text-white/60 mb-1">Description</div>
            <textarea name="description" className="ui-textarea" placeholder="Optional description" />
          </label>

          <button className="ui-button" type="submit">Create download</button>
        </div>
      </form>
    </PageShell>
  );
}
