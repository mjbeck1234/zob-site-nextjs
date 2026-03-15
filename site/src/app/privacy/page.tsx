import PageShell from '@/components/PageShell';
import { site } from '@/lib/site';

export default function PrivacyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      subtitle="How this site stores and uses information."

      crumbs={[{ href: '/', label: 'Home' }, { label: 'Privacy' }]}
    >
      <div className="max-w-3xl">
        <div className="ui-card">
          <div className="ui-card__body space-y-3 text-sm text-slate-700">
            <p>
              This site may store data you submit (for example: feedback, visit requests, and staffing requests) in the facility’s Postgres database.
            </p>
            <p>
              Authentication (if enabled) uses VATSIM OAuth via <span className="font-semibold">auth.vatsim.net</span> and stores a minimal session cookie.
            </p>
            <p>
              Questions? Contact the Virtual {site.name} staff.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
