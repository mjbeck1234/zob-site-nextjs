import Link from 'next/link';
import PageShell from '@/components/PageShell';

export default function BriefingPage() {
  return (
    <PageShell
      title="Facility Briefing"
      subtitle="Quick links for pilots and controllers."

      crumbs={[{ href: '/', label: 'Home' }, { label: 'Briefing' }]}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">For Pilots</div>
          </div>
          <div className="ui-card__body">
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/routing" className="font-semibold">
                  Preferred routing
                </Link>
              </li>
              <li>
                <Link href="/events" className="font-semibold">
                  Upcoming events
                </Link>
              </li>
              <li>
                <Link href="/feedback" className="font-semibold">
                  Submit feedback
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">For Controllers</div>
          </div>
          <div className="ui-card__body">
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/downloads" className="font-semibold">
                  Downloads
                </Link>
              </li>
              <li>
                <Link href="/splits" className="font-semibold">
                  Current splits
                </Link>
              </li>
              <li>
                <Link href="/staff" className="font-semibold">
                  Staff directory
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="ui-card mt-6">
        <div className="ui-card__body">
          <div className="text-sm text-slate-700">
            This page is a starter. If you want, I can port the full PHP facility briefing layout (including charts, SOP shortcuts, and event tiles) into this theme.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
