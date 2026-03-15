import PageShell from '@/components/PageShell';
import { getStaff } from '@/lib/content';

export default async function StaffPage() {
  const staff = await getStaff();

  return (
    <PageShell
      title="Staff"
      subtitle="Facility administration and training staff."

      crumbs={[{ href: '/', label: 'Home' }, { label: 'Staff' }]}
    >
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Staff Directory</div>
          <span className="ui-badge">{staff.length}</span>
        </div>
        <div className="ui-card__body">
          <div className="grid gap-4 md:grid-cols-2">
            {staff.map((s: any, idx: number) => {
              const computedName = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
              const name = (s.name ?? computedName) || `Staff #${idx + 1}`;
              const role = s.title ?? s.position ?? s.role ?? '';
              return (
                <div key={String(s.id ?? `${name}-${idx}`)} className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold">{name}</div>
                  <div className="mt-1 text-sm text-slate-700">{role}</div>
                  {s.email ? (
                    <div className="mt-2 text-sm">
                      <a href={`mailto:${s.email}`} className="font-semibold">
                        {s.email}
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!staff.length ? <div className="text-sm text-slate-600">No staff rows found.</div> : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
