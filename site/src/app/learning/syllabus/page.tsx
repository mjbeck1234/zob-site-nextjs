import Link from 'next/link';
import { redirect } from 'next/navigation';
import PageShell from '@/components/PageShell';
import PermissionNotice from '@/components/PermissionNotice';
import { getUser } from '@/lib/auth/getUser';
import { storedSyllabusEnabled } from '@/lib/syllabusStore';
import { deriveRoles, canEditSyllabus } from '@/lib/auth/permissions';
import { getRoster } from '@/lib/content';

function displayRosterName(r: any) {
  const pref = String(r?.pref_name ?? r?.prefName ?? '').trim();
  const first = pref || String(r?.first_name ?? r?.firstName ?? '').trim();
  const last = String(r?.last_name ?? r?.lastName ?? '').trim();
  const cid = r?.cid ? String(r.cid) : r?.controller_cid ? String(r.controller_cid) : '';
  const base = `${first} ${last}`.trim();
  return `${base || 'Unknown'}${cid ? ` (#${cid})` : ''}`;
}

export default async function SyllabusHubPage({ searchParams }: { searchParams: Promise<{ forbidden?: string; missing?: string }> }) {
  const sp = await searchParams;
  const user = await getUser();

  if (!user) {
    return (
      <PageShell
        title="Syllabus"
        subtitle="Mentor-fillable training syllabus / progress checklist."
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'Syllabus' }]}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <PermissionNotice kind="login" />
          </div>
        </div>
      </PageShell>
    );
  }

  const roles = deriveRoles(user);
  const isMember = roles.tier !== 'non_member';
  const canEdit = canEditSyllabus(user);

  // Regular members should land directly on their own syllabus instead of the
  // interim hub page. Only mentors/instructors/training staff should see the
  // student picker hub.
  if (isMember && !canEdit) {
    redirect(`/learning/syllabus/${user.cid}`);
  }

  const existingOk = await storedSyllabusEnabled();

  const rosterRows = (await getRoster().catch(() => [])) as any[];
  const roster = (Array.isArray(rosterRows) ? rosterRows : [])
    .map((r) => ({ cid: Number(r.cid ?? r.controller_cid ?? 0), name: displayRosterName(r) }))
    .filter((x) => x.cid > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell
      title="Syllabus"
      subtitle="Track training progress with a simple checklist — view your own, or (mentors) update a student's."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { label: 'Syllabus' }]}
    >
      {!isMember ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <PermissionNotice kind="member" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ui-card">
            <div className="ui-card__header">
              <div>
                <div className="text-sm font-semibold">My Syllabus</div>
                <div className="text-xs text-white/60">Your personal progress checklist</div>
              </div>
              <Link href={`/learning/syllabus/${user.cid}`} className="ui-btn ui-btn--primary">
                Open
              </Link>
            </div>
            <div className="ui-card__body">
              <div className="text-sm text-white/70">
                View the baseline syllabus template, mark items complete with your mentor, and keep notes in one place.
              </div>
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card__header">
              <div>
                <div className="text-sm font-semibold">Mentor Tools</div>
                <div className="text-xs text-white/60">Open and update a student's checklist</div>
              </div>
            </div>
            <div className="ui-card__body">
              {!canEdit ? (
                <div className="text-sm text-white/70">Editing is restricted to mentors / instructors / training staff.</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-white/70">Select a student from the roster to open their syllabus.</div>
                  <form action="/learning/syllabus/open" method="get" className="flex gap-2">
                    <select name="cid" className="ui-input flex-1">
                      <option value="">Select a student...</option>
                      {roster.map((r) => (
                        <option key={String(r.cid)} value={String(r.cid)}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button className="ui-btn ui-btn--primary" type="submit">
                      Open
                    </button>
                  </form>
</div>
              )}
            </div>
          </div>
        </div>
      )}
{sp.forbidden ? (
        <div className="mb-4 ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/80">You don't have permission to edit syllabi.</div>
          </div>
        </div>
      ) : null}
      {sp.missing ? (
        <div className="mb-4 ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/80">Select a student to open their syllabus.</div>
          </div>
        </div>
      ) : null}

    </PageShell>
  );
}
