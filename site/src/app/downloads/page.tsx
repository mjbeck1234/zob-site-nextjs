import PageShell from '@/components/PageShell';
import { getDownloadsByCategory } from '@/lib/content';
import { tableHasColumn } from '@/lib/schema';
import { getUser } from '@/lib/auth/getUser';
import { site } from '@/lib/site';

const CATEGORIES = ['vATIS', 'SOPs', 'LOAs', 'Reference', 'Policies', 'Training'] as const;

function normalizeDownloadHref(raw: any) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  // Already absolute
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;

  // If you set a existing base URL, treat relative paths as ui-hosted.
  // Otherwise, keep them as-is so the current site can serve them.
  const siteBase = (process.env.DOWNLOADS_SITE_BASE_URL ?? '').trim();
  if (!siteBase) return s;

  const base = siteBase.replace(/\/+$/, '') || `https://${site.domain}`;
  if (s.startsWith('/')) return `${base}${s}`;
  return `${base}/${s.replace(/^\/+/, '')}`;
}

function fileLink(row: any) {
  // Support existing column names from the old site.
  const raw =
    row.url ??
    row.link ??
    row.file_url ??
    row.file_path ??
    row.path ??
    row.file ??
    row.filename ??
    row.file_name ??
    null;

  // Some old schemas store directory + filename separately.
  if (!raw && (row.dir || row.directory) && (row.file || row.filename || row.file_name)) {
    const d = String(row.dir ?? row.directory ?? '').replace(/\/+$/, '');
    const f = String(row.file ?? row.filename ?? row.file_name ?? '').replace(/^\/+/, '');
    if (d && f) return normalizeDownloadHref(`${d}/${f}`);
  }

  return normalizeDownloadHref(raw);
}

function DownloadsTable({ rows }: { rows: any[] }) {
  return (
    <div className="ui-card overflow-hidden">
      <div className="max-h-[65vh] overflow-auto">
        <table className="ui-table">
          <thead>
            <tr>
              <th style={{ width: '38%' }}>File</th>
              <th>Description</th>
              <th style={{ width: '16%' }}>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d: any) => {
              const href = fileLink(d);
              const label = d.file_name ?? d.name ?? d.title ?? `#${d.id}`;
              return (
                <tr key={String(d.id ?? label)}>
                  <td className="font-semibold">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer">
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </td>
                  <td>{d.description ?? d.notes ?? ''}</td>
                  <td>{d.upload_date ? String(d.upload_date) : ''}</td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={3} style={{ padding: '16px 12px' }}>
                  <span className="text-sm opacity-70">No downloads found.</span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function DownloadsPage() {
  const user = await getUser();
  const roles = user?.roles ?? [];
  const canSeeTraining = roles.some((r) => ['mentor', 'ins', 'ATM', 'DATM', 'TA', 'ATA', 'WM', 'AWM', 'staff'].includes(r));

  const downloadsArchiveUrl = (process.env.DOWNLOADS_ARCHIVE_URL ?? '').trim();

  const hasCategory = await tableHasColumn('downloads', 'category').catch(() => false);

  // If the schema doesn't support categories, show everything in one list
  if (!hasCategory) {
    const all = await getDownloadsByCategory(undefined);
    return (
      <PageShell title="Downloads" subtitle="Documents and resources." crumbs={[{ href: '/', label: 'Home' }, { label: 'Downloads' }]}>
        {downloadsArchiveUrl ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            Looking for older files?{' '}
            <a className="underline" href={downloadsArchiveUrl} target="_blank" rel="noreferrer">
              Open the downloads archive archive
            </a>
            .
          </div>
        ) : null}
        <DownloadsTable rows={all} />
      </PageShell>
    );
  }

  const visibleCategories = CATEGORIES.filter((c) => (c === 'Training' ? canSeeTraining : true));

  const entries = await Promise.all(visibleCategories.map(async (c) => ({ category: c, rows: await getDownloadsByCategory(c) })));

  const totalRows = entries.reduce((acc, e) => acc + (e.rows?.length ?? 0), 0);

  return (
    <PageShell title="Downloads" subtitle="Documents and resources." crumbs={[{ href: '/', label: 'Home' }, { label: 'Downloads' }]}>
      <div className="space-y-6">
        {downloadsArchiveUrl ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            {totalRows ? (
              <>Need something that hasn’t been migrated yet? </>
            ) : (
              <>No downloads are available here yet. </>
            )}
            <a className="underline" href={downloadsArchiveUrl} target="_blank" rel="noreferrer">
              Open the downloads archive archive
            </a>
            .
          </div>
        ) : null}
        {entries.map(({ category, rows }) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{category}</h2>
              <span className="ui-badge">{rows.length}</span>
            </div>
            <DownloadsTable rows={rows} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
