import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';

import AdminStatusClient from './AdminStatusClient';

export const dynamic = 'force-dynamic';

export default async function AdminStatusPage() {
  await requireAdmin();

  return (
    <PageShell
      title="System Status"
      subtitle="Live health checks for the site (auto-refreshes every 30 seconds)."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { label: 'System Status' }]}
    >
      <AdminStatusClient />
    </PageShell>
  );
}
