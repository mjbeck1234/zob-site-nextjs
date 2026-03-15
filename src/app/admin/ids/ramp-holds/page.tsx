import { requireStaff } from '@/lib/auth/guards';
import PageShell from '@/components/PageShell';
import { RampHoldsClient } from './RampHoldsClient';

export default async function RampHoldsAdminPage() {
  await requireStaff();
  return (
    <PageShell title="IDS Ramp Holds">
      <RampHoldsClient />
    </PageShell>
  );
}
