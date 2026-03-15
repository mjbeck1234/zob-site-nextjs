import PageShell from '@/components/PageShell';
import { redirect } from 'next/navigation';
import { createVisitRequest } from '@/lib/content';

async function submit(formData: FormData) {
  'use server';
  const cid = formData.get('cid')?.toString().trim();
  const fullName = formData.get('fullName')?.toString().trim();
  const email = formData.get('email')?.toString().trim();
  const rating = formData.get('rating')?.toString().trim();
  const message = formData.get('message')?.toString().trim();

  if (!cid || !fullName) redirect('/visit?error=missing');

  const cidNum = Number.parseInt(cid, 10);
  if (!Number.isFinite(cidNum) || cidNum <= 0) redirect('/visit?error=missing');


  await createVisitRequest({
    cid: cidNum,
    fullName,
    email: email || undefined,
    rating: rating || undefined,
    // The content layer uses the field name "reason" for visit requests.
    reason: message || undefined,
  });

  redirect('/visit?sent=1');
}

const input =
  'h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/20';
const textarea =
  'min-h-[160px] rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/20';

export default async function VisitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;

  const sent = sp.sent === '1';
  const error = sp.error;

  return (
    <PageShell title="Visit" subtitle="Request to visit Cleveland ARTCC (ZOB)." crumbs={[{ href: '/', label: 'Home' }, { label: 'Visit' }]}>
      <div className="max-w-2xl">
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">Visiting Request</div>
            <div className="flex items-center gap-2">
              {sent ? <span className="ui-badge">Submitted</span> : null}
              {error ? <span className="ui-badge">Fix highlighted fields</span> : null}
            </div>
          </div>

          <div className="ui-card__body">
            <form action={submit} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">CID *</span>
                  <input name="cid" className={input} required placeholder="123456" />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Full Name *</span>
                  <input name="fullName" className={input} required placeholder="Your name" />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Email</span>
                  <input name="email" className={input} placeholder="Optional" />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-semibold text-white/85">Rating</span>
                  <input name="rating" className={input} placeholder="S1, S2, S3..." />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-sm font-semibold text-white/85">Message</span>
                <textarea
                  name="message"
                  className={textarea}
                  placeholder="Tell us a little about your experience and why you'd like to visit."
                />
              </label>

              <button className="h-11 w-fit rounded-xl border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/[0.14]">
                Submit request
              </button>
            </form>

            <p className="mt-4 text-xs text-white/55">
              Note: This form is for VATSIM network use only. Visiting approval is subject to facility policy.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
