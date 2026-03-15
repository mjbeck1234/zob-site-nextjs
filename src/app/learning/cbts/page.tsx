import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getUser } from '@/lib/auth/getUser';
import { deriveRoles } from '@/lib/auth/permissions';
import { listPublishedCbtSectionsWithCbts, listViewedCbtIdsForUser } from '@/lib/cbts';
import CbtsClient from './CbtsClient';

export default async function CbtsPage() {
  const user = await getUser();

  if (!user) {
    return (
      <PageShell
        title="Learning Center"
        subtitle="CBTs"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'CBTs' }]}
        right={<Link href="/learning" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">You must be signed in to view CBTs.</div>
            <div className="mt-4">
              <a href="/api/auth/login" className="ui-btn ui-btn--primary">Login with VATSIM</a>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const d = deriveRoles(user);
  if (d.tier === 'non_member') {
    return (
      <PageShell
        title="Learning Center"
        subtitle="CBTs"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'CBTs' }]}
        right={<Link href="/learning" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              CBTs are for ZOB controllers (home/visiting) and staff. If you are transferring in, contact staff.
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const [{ sections, cbts, dbOk }, viewed] = await Promise.all([
    listPublishedCbtSectionsWithCbts(),
    listViewedCbtIdsForUser(user.cid),
  ]);

  return (
    <PageShell
      title="CBTs"
      subtitle="Controller briefings and theory modules"
      crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'CBTs' }]}
      right={<Link href="/learning" className="ui-link">← Back</Link>}
    >
      {!dbOk ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">
              CBTs are not available yet because the current tables (<code className="text-white/80">sections</code>, <code className="text-white/80">cbts</code>, <code className="text-white/80">cbt_results</code>) were not found in the database.
            </div>
            <div className="mt-3 text-sm text-white/70">
              Once those tables are present (from your existing import), this page will populate automatically.
            </div>
          </div>
        </div>
      ) : (
        <CbtsClient sections={sections} cbts={cbts} initialViewedIds={viewed} />
      )}
    </PageShell>
  );
}
