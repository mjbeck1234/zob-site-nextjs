import PageShell from '@/components/PageShell';
import { redirect } from 'next/navigation';
import { createFeedback, getRoster, getRosterEntryByCid } from '@/lib/content';
import { requireLogin } from '@/lib/auth/guards';
import { getUser } from '@/lib/auth/getUser';

type RosterRow = Record<string, any>;

function rosterNameOnly(r: RosterRow): string {
  const first = String(r.first_name ?? r.firstName ?? '').trim();
  const last = String(r.last_name ?? r.lastName ?? '').trim();
  const pref = String(r.pref_name ?? r.prefName ?? '').trim();
  const name = String(r.name ?? r.full_name ?? r.fullName ?? '').trim();
  return (pref && last) ? `${pref} ${last}` : (first && last) ? `${first} ${last}` : name;
}

function rosterLabel(r: RosterRow): string {
  const cid = String(r.cid ?? r.controller_cid ?? '').trim();
  const base = rosterNameOnly(r) || cid || 'Unknown';
  return cid ? `${base} (${cid})` : base;
}

const POSITION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'DEL', label: 'Clearance Delivery' },
  { value: 'GND', label: 'Ground Control' },
  { value: 'TWR', label: 'Local Control (Tower)' },
  { value: 'APP', label: 'TRACON (Approach or Departure)' },
  { value: 'CTR', label: 'Enroute (Center)' },
];

const RATING_OPTIONS = ['Unsatisfactory', 'Poor', 'Fair', 'Good', 'Excellent'] as const;

async function submit(formData: FormData) {
  'use server';
  const user = await requireLogin();

  // Pilot email is required (prefilled from login, but user may edit)
  const pilotEmail = formData.get('email')?.toString().trim();

  const controllerCidRaw = formData.get('controllerCid')?.toString().trim();
  const controllerNameManual = formData.get('controllerName')?.toString().trim();
  const posCategory = formData.get('posCategory')?.toString().trim().toUpperCase();
  const serviceLevel = formData.get('serviceLevel')?.toString().trim();
  const comments = formData.get('comments')?.toString().trim();

  if (!pilotEmail || !controllerCidRaw || !posCategory || !serviceLevel || !comments) {
    redirect('/feedback?error=missing');
  }

  // Simple email sanity check
  if (!pilotEmail.includes('@') || pilotEmail.length < 6) {
    redirect('/feedback?error=missing');
  }

  // Validate enums defensively
  const posOk = POSITION_OPTIONS.some((p) => p.value === posCategory);
  const ratingOk = (RATING_OPTIONS as readonly string[]).includes(serviceLevel);
  if (!posOk || !ratingOk) {
    redirect('/feedback?error=invalid');
  }

  const controllerCid = Number.parseInt(controllerCidRaw, 10);
  if (!Number.isFinite(controllerCid)) {
    redirect('/feedback?error=invalid');
  }

  const roster = await getRosterEntryByCid(controllerCid).catch(() => undefined);
  const controllerEmail = roster
    ? String((roster as any).email ?? (roster as any).controller_email ?? '').trim() || null
    : null;

  // Prefer roster name; fall back to manual; finally fall back to CID so we never insert undefined.
  const controllerName = roster
    ? (rosterNameOnly(roster as any) || rosterLabel(roster as any) || `CID ${controllerCid}`)
    : (controllerNameManual || `CID ${controllerCid}`);

  const pilotName = String(user.fullName ?? '').trim() || `CID ${user.cid}`;

  await createFeedback({
    pilotCid: Number(user.cid),
    pilotName,
    pilotEmail,
    controllerCid,
    controllerName,
    controllerEmail,
    posCategory,
    serviceLevel,
    comments,
  });

  redirect('/feedback?sent=1');
}

const input =
  'h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/20';
const textarea =
  'min-h-[160px] rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/20';

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getUser();
  const sp = await searchParams;

  // If not logged in, show a friendly message rather than a generic redirect.
  if (!user) {
    return (
      <PageShell title="Feedback" subtitle="Pilot feedback form." crumbs={[{ href: '/', label: 'Home' }, { label: 'Feedback' }]}>
        <div className="max-w-2xl">
          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Login required</div>
            </div>
            <div className="ui-card__body">
              <p className="text-sm text-white/75">
                You must be logged in to submit and view the feedback form.
              </p>
              <div className="mt-4">
                <a href="/api/auth/login" className="ui-btn ui-btn--primary">
                  Login with VATSIM
                </a>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const sent = sp.sent === '1';
  const error = sp.error === 'missing';
  const invalid = sp.error === 'invalid';

  const roster = (await getRoster().catch(() => [])) as unknown as RosterRow[];
  const controllers = roster
    .filter((r) => String((r as any).cid ?? '').trim())
    .map((r) => ({ cid: String((r as any).cid).trim(), label: rosterLabel(r) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <PageShell title="Feedback" subtitle="Pilot feedback form." crumbs={[{ href: '/', label: 'Home' }, { label: 'Feedback' }]}>
      <div className="max-w-2xl">
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">Submit Feedback</div>
            <div className="flex items-center gap-2">
              {sent ? <span className="ui-badge">Sent</span> : null}
              {error ? <span className="ui-badge">Required fields missing</span> : null}
              {invalid ? <span className="ui-badge">Invalid selection</span> : null}
            </div>
          </div>

          <div className="ui-card__body">
            <form action={submit} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Pilot CID</span>
                  <input name="pilotCid" className={input} value={String(user.cid)} readOnly />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Pilot Name</span>
                  <input name="pilotName" className={input} value={user.fullName ?? ''} readOnly />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Email</span>
                  <input
                    name="email"
                    type="email"
                    className={input}
                    defaultValue={user.email ?? ''}
                    placeholder="you@example.com"
                    required
                  />
                </label>

                {controllers.length ? (
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-white/85">Controller</span>
                    <select name="controllerCid" className={input} defaultValue="" required>
                      <option value="" disabled>
                        Select controller…
                      </option>
                      {controllers.map((c) => (
                        <option key={c.cid} value={c.cid}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-sm font-semibold text-white/85">Controller CID</span>
                      <input name="controllerCid" className={input} placeholder="e.g. 1234567" required />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-sm font-semibold text-white/85">Controller Name</span>
                      <input name="controllerName" className={input} placeholder="First Last" required />
                    </label>
                  </div>
                )}

                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Position</span>
                  <select name="posCategory" className={input} defaultValue="" required>
                    <option value="" disabled>
                      Select position…
                    </option>
                    {POSITION_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Rating</span>
                  <select name="serviceLevel" className={input} defaultValue="" required>
                    <option value="" disabled>
                      Select rating…
                    </option>
                    {RATING_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Comments</span>
                <textarea name="comments" className={textarea} placeholder="Tell us about your experience..." required />
              </label>

              <button className="h-11 w-fit rounded-xl border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/[0.14]">
                Send
              </button>
            </form>

            <p className="mt-4 text-xs text-white/55">
              This form is for VATSIM network use only. Please avoid sharing personal information beyond what is necessary.
            </p>

            {invalid ? <p className="mt-3 text-sm text-red-200/90">Invalid position or rating selection.</p> : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
