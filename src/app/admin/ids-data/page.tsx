import { requireSiteAdminOnly } from '@/lib/auth/admin';
import { listIdsDatasets } from '@/lib/idsDataset';

import { IDSDataClient } from './ui';

export const metadata = {
  title: 'IDS Data - Admin',
};

export default async function IDSDataAdminPage() {
  await requireSiteAdminOnly();
  const datasets = await listIdsDatasets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">IDS Data</h1>
        <p className="text-sm text-muted-foreground">
          Refresh FAA NASR datasets (APT/NAV/FIX/AWY/PFR/STARDP) used by the IDS route tools.
        </p>
      </div>

      <IDSDataClient datasets={datasets} />
    </div>
  );
}
