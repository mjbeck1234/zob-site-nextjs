import Link from 'next/link';

import PageShell from '@/components/PageShell';
import SplitsMaps, { SplitRow } from '@/components/splits/SplitsMaps';
import { getUser } from '@/lib/auth/getUser';
import { canManageSplits } from '@/lib/auth/permissions';
import { getSplitsForActiveSelection } from '@/lib/content';

export const dynamic = 'force-dynamic';

function toClientRows(rows: any[]): SplitRow[] {
  return (rows ?? []).map((r, idx) => ({
    id: Number(r?.id ?? idx + 1),
    callsign: String(r?.callsign ?? ''),
    frequency: String(r?.frequency ?? ''),
    type: String(r?.type ?? ''),
    splits: r?.splits ?? r?.splits_json ?? r?.sectors ?? r?.sector_list ?? null,
  }));
}


export default async function SplitsPage() {
  const [{ rows }, user] = await Promise.all([getSplitsForActiveSelection(), getUser()]);
  const canManage = user ? canManageSplits(user) : false;

  return (
    <PageShell
      title="Splits"
      subtitle="Live ZOB sector split maps."
      right={
        canManage ? (
          <Link href="/admin/splits" className="ui-btn ui-btn--primary">
            Manage Splits
          </Link>
        ) : null
      }
    >
      <SplitsMaps rows={toClientRows(rows)} />
    </PageShell>
  );
}
