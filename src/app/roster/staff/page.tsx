import PageShell from '@/components/PageShell';
import { getRoster } from '@/lib/content';
import { site } from '@/lib/site';
import { rosterDisplayName } from '@/lib/names';

export const dynamic = 'force-dynamic';

type StaffSlot = {
  code: 'ATM' | 'DATM' | 'TA' | 'WM' | 'WT' | 'EC' | 'AEC' | 'FE' | 'AFE';
  title: string;
  primary: boolean;
};

const STAFF_SLOTS: StaffSlot[] = [
  { code: 'ATM', title: 'Air Traffic Manager', primary: true },
  { code: 'DATM', title: 'Deputy Air Traffic Manager', primary: true },
  { code: 'TA', title: 'Training Administrator', primary: true },
  { code: 'EC', title: 'Events Coordinator', primary: true },
  { code: 'AEC', title: 'Assistant Events Coordinator', primary: false },
  { code: 'WM', title: 'Webmaster', primary: true },
  { code: 'WT', title: 'Web Team', primary: false },
  { code: 'FE', title: 'Facility Engineer', primary: true },
  { code: 'AFE', title: 'Assistant Facility Engineer', primary: false },
];

function toStr(v: any): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

function isYesish(v: any): boolean {
  if (typeof v === 'boolean') return v;
  const s = toStr(v).trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' || s === 'y' || s === 't';
}

function fullName(r: any): string {
  return rosterDisplayName(r);
}

function profilePicUrl(r: any): string {
  const raw = toStr(r?.profile_picture ?? r?.profilePicture ?? r?.avatar_url ?? r?.avatarUrl).trim();
  if (raw) return raw;
  return `https://${site.domain}/files/pictures/profile.png`;
}

function PersonCard({ name, subtitle, img }: { name: string; subtitle: string; img: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt="Profile"
          className="h-14 w-14 rounded-2xl border border-white/10 bg-white/5 object-cover"
        />
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-white">{name}</div>
          <div className="mt-1 text-sm text-white/65">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

export default async function StaffRosterPage() {
  const rows = ((await getRoster().catch(() => [])) as any[]) ?? [];

  const byStaff = new Map<string, any[]>();
  for (const s of STAFF_SLOTS) byStaff.set(s.code, []);
  for (const r of rows) {
    const code = toStr(r?.staff).trim().toUpperCase();
    if (byStaff.has(code)) byStaff.get(code)!.push(r);
  }

  const instructors = rows
    .filter((r) => isYesish(r?.ins))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const mentors = rows
    .filter((r) => isYesish(r?.mentor))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  return (
    <PageShell
      title="Roster"
      subtitle="ARTCC staff"
      crumbs={[{ href: '/', label: 'Home' }, { href: '/roster', label: 'Roster' }, { label: 'Staff' }]}
    >
      {/* Facility staff */}
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Facility Staff</div>
          <span className="ui-badge">Roster</span>
        </div>
        <div className="ui-card__body">
          <div className="grid gap-4 md:grid-cols-3">
            {STAFF_SLOTS.flatMap((slot) => {
              const members = (byStaff.get(slot.code) ?? []) as any[];
              if (!members.length) {
                return slot.primary
                  ? [
                      <PersonCard
                        key={`vacant-${slot.code}`}
                        name="Vacant"
                        subtitle={`${slot.title} (${slot.code})`}
                        img={`https://${site.domain}/files/pictures/profile.png`}
                      />,
                    ]
                  : [];
              }
              return members.map((m, idx) => (
                <PersonCard
                  key={`${slot.code}-${toStr(m?.cid) || idx}`}
                  name={fullName(m)}
                  subtitle={`${slot.title} (${slot.code})`}
                  img={profilePicUrl(m)}
                />
              ));
            })}
          </div>
        </div>
      </div>

      {/* Instructors */}
      <div className="ui-card mt-4">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Instructors</div>
          <span className="ui-badge">INS</span>
        </div>
        <div className="ui-card__body">
          {instructors.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {instructors.map((r, idx) => (
                <PersonCard
                  key={`ins-${toStr(r?.cid) || idx}`}
                  name={fullName(r)}
                  subtitle="Instructor"
                  img={profilePicUrl(r)}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/70">No instructors found.</div>
          )}
        </div>
      </div>

      {/* Mentors */}
      <div className="ui-card mt-4">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Mentors</div>
          <span className="ui-badge">Mentor</span>
        </div>
        <div className="ui-card__body">
          {mentors.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {mentors.map((r, idx) => {
                const mentorTitle = toStr(r?.mentor_name).trim() || 'Mentor';
                return (
                  <PersonCard
                    key={`mentor-${toStr(r?.cid) || idx}`}
                    name={fullName(r)}
                    subtitle={mentorTitle}
                    img={profilePicUrl(r)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-white/70">No mentors found.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
