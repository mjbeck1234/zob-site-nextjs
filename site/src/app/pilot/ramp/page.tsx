import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/guards';
import RampGateClient from './RampGateClient';

export const dynamic = 'force-dynamic';

export default async function PilotRampPage() {
  await requireLogin();

  return (
    <PageShell
      fullWidth
      title="Ramp gate selection"
      subtitle="View KDTW gates and reserve a spot using your VATSIM flight plan. Reservations show up as HELD gates for controllers in IDS."
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/pilot/resources', label: 'Pilot' },
        { label: 'Ramp gate selection' },
      ]}
    >
      <RampGateClient />
    </PageShell>
  );
}
