import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import NewSplitForm from './NewSplitForm';
import { createSplitAction } from '../actions';

export default async function NewSplitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const error = sp?.error;

  return (
    <PageShell
      title="Admin • New Split"
      subtitle="Create a High or Low split and select sectors via checkboxes."
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        { href: '/admin/splits', label: 'Splits' },
        { label: 'New' },
      ]}
      right={
        <Link href="/admin/splits" className="ui-btn ui-btn--ghost">
          Back
        </Link>
      }
    >
      <NewSplitForm error={error} onCreate={createSplitAction} />
    </PageShell>
  );
}
