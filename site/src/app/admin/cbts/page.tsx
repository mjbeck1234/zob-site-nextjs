import Link from 'next/link';
import { redirect } from 'next/navigation';
import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import { canManageCbts } from '@/lib/auth/permissions';
import { listAllCbtSectionsWithCbts } from '@/lib/cbtsAdmin';
import AdminCbtsClient from './ui';

export default async function AdminCbtsPage() {
  const user = await requireAdmin();
  if (!canManageCbts(user)) redirect('/?auth=forbidden');

  const data = await listAllCbtSectionsWithCbts();

  return (
    <PageShell
      title="CBTs"
      subtitle="Create and manage CBT sections and modules"
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin/exams', label: 'Admin' }, { label: 'CBTs' }]}
      right={<Link href="/admin/exams" className="ui-link">← Back</Link>}
    >
      {!data.dbOk ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              CBT tools are not available yet because the current tables (<code className="text-white/80">sections</code>, <code className="text-white/80">cbts</code>, <code className="text-white/80">cbt_results</code>) were not found in the database.
            </div>
            <div className="mt-3 text-sm text-white/70">
              Import your previous site SQL (or create the tables), then refresh this page.
            </div>
          </div>
        </div>
      ) : (
        <AdminCbtsClient initialSections={data.sections} initialCbts={data.cbts} />
      )}
    </PageShell>
  );
}
