import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getUser } from '@/lib/auth/getUser';
import { deriveRoles } from '@/lib/auth/permissions';
import { getNextFDPCaseForUser } from '@/lib/flightDataPractice';
import FlightDataPracticeClient from './practice/FlightDataPracticeClient';

export default async function FlightDataPracticePage() {
  const user = await getUser();

  if (!user) {
    return (
      <PageShell
        title="Learning Center"
        subtitle="Flight Data Practice"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'Flight Data Practice' }]}
        right={<Link href="/learning" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">You must be signed in to use Flight Data Practice.</div>
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
        subtitle="Flight Data Practice"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'Flight Data Practice' }]}
        right={<Link href="/learning" className="ui-link">← Back</Link>}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">Flight Data Practice is for ZOB controllers (home/visiting) and staff. If you are transferring in, contact staff.</div>
          </div>
        </div>
      </PageShell>
    );
  }

  const next = await getNextFDPCaseForUser(user.cid);

  return (
    <PageShell
      title="Flight Data Practice"
      subtitle="Fix the flight plan. When you get it right, click New Plan to load the next one."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'Flight Data Practice' }]}
      right={<Link href="/learning" className="ui-link">← Back</Link>}
    >
      <FlightDataPracticeClient initialCase={next as any} />
    </PageShell>
  );
}
