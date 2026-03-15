import PageShell from '@/components/PageShell';
import { requireAdmin } from '@/lib/auth/admin';
import RampOverridesClient from './RampOverridesClient';

export default async function AdminRampOverridesPage() {
  await requireAdmin();

  return (
    <PageShell
      title="Admin • Ramp Overrides"
      subtitle="Add missing stands, or hide problematic ones. Changes apply to both IDS and Pilot ramp maps."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin/status', label: 'System Status' }, { label: 'Ramp Overrides' }]}
    >
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
        <div className="font-semibold text-white">How this works</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <span className="font-semibold text-white/90">Add</span> rows create <span className="font-mono">manual:&lt;id&gt;</span> stands that appear on the ramp map.
          </li>
          <li>
            <span className="font-semibold text-white/90">Hide</span> rows suppress an existing stand by its stand id (<span className="font-mono">node:123</span>, <span className="font-mono">way:456</span>, etc.).
          </li>
          <li>Disable an override to undo it (no deletes required).</li>
        </ul>
      </div>

      <RampOverridesClient />
    </PageShell>
  );
}
