import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { getById } from '@/lib/admin/crud';
import { normSplitType } from '@/lib/splits/sectorGroups';
import EditSplitForm from './EditSplitForm';
import { deleteSplitAction, updateSplitAction } from '../actions';

function parseSectors(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim().toUpperCase()).filter(Boolean);
  }
  const s = String(value ?? '').trim();
  if (!s) return [];
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? '').trim().toUpperCase()).filter(Boolean);
    } catch {}
  }
  return s
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

export default async function EditSplitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const saved = (sp?.saved ?? '') === '1';

  const r = await getById('splits', id);
  if (!r) {
    return (
      <PageShell
        title="Admin • Split"
        subtitle="Not found."
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/admin', label: 'Admin' },
          { href: '/admin/splits', label: 'Splits' },
          { label: 'Missing' },
        ]}
        right={
          <Link href="/admin/splits" className="ui-btn ui-btn--ghost">
            Back
          </Link>
        }
      >
        <div className="text-sm text-white/60">Split not found.</div>
      </PageShell>
    );
  }

  const type = normSplitType(r.type) === 'low' ? 'low' : 'high';

  // Bind server actions here (server component) and pass them down to the client form.
  const onSave = updateSplitAction.bind(null, String(id));
  const onDelete = deleteSplitAction.bind(null, String(id));

  return (
    <PageShell
      title="Admin • Edit Split"
      subtitle="Update the split and its sectors."
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        { href: '/admin/splits', label: 'Splits' },
        { label: String(r.callsign ?? id) },
      ]}
      right={
        <Link href="/admin/splits" className="ui-btn ui-btn--ghost">
          Back
        </Link>
      }
    >
      <EditSplitForm
        id={String(id)}
        saved={saved}
        onSave={onSave}
        onDelete={onDelete}
        initial={{
          callsign: String(r.callsign ?? ''),
          frequency: String(r.frequency ?? ''),
          type,
          sectors: parseSectors(r.splits),
        }}
      />
    </PageShell>
  );
}
