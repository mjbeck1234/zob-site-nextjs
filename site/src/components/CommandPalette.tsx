'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Action = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  keywords?: string;
};

function norm(s: string): string {
  return (s ?? '').toLowerCase().trim();
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const actions: Action[] = useMemo(
    () => [
      { id: 'ids', label: 'Open IDS', hint: '/ids', href: '/ids', keywords: 'ids information display system' },
      { id: 'ids-airport', label: 'IDS: Airport quick look', hint: 'Airport', href: '/ids?tab=airport', keywords: 'airport quick look dtpp' },
      { id: 'ids-ramp', label: 'IDS: Ramp view', hint: 'Ramp', href: '/ids?tab=ramp', keywords: 'ramp gates ground traffic' },
      { id: 'ids-ramp-dtw', label: 'IDS: Ramp view (KDTW)', hint: 'Ramp · DTW', href: '/ids?tab=ramp&rampAirport=KDTW', keywords: 'dtw detroit ramp gates' },
      { id: 'ids-status', label: 'IDS: Status', hint: 'Status', href: '/ids?tab=status', keywords: 'status cards atis flow' },

      { id: 'pilot-ramp', label: 'Ramp gate selection (Pilots)', hint: '/pilot/ramp', href: '/pilot/ramp', keywords: 'pilot gate ramp reserve hold dtw' },
      { id: 'pilot-resources', label: 'Pilot: Resources', hint: '/pilot/resources', href: '/pilot/resources', keywords: 'pilot resources docs links' },

      { id: 'downloads', label: 'Downloads', hint: '/downloads', href: '/downloads', keywords: 'downloads documents resources loas sops policies' },
      { id: 'events', label: 'Events', hint: '/events', href: '/events', keywords: 'events fly-in signup' },
      { id: 'roster', label: 'Roster', hint: '/roster', href: '/roster', keywords: 'roster controllers staff' },
      { id: 'profile', label: 'My profile', hint: '/profile', href: '/profile', keywords: 'profile account' },
    ],
    []
  );

  const filtered = useMemo(() => {
    const nq = norm(q);
    if (!nq) return actions;
    return actions
      .map((a) => {
        const hay = `${a.label} ${a.hint ?? ''} ${a.keywords ?? ''}`.toLowerCase();
        const score =
          hay.includes(nq) ? 0 : Math.min(...nq.split(/\s+/g).map((t) => (hay.includes(t) ? 1 : 10)).concat([10]));
        return { a, score };
      })
      .filter((x) => x.score < 10)
      .sort((x, y) => x.score - y.score)
      .map((x) => x.a);
  }, [q, actions]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-9 px-3 rounded-xl"
        onClick={() => setOpen(true)}
        title="Search (Ctrl/Cmd+K)"
      >
        Search
        <span className="ml-2 hidden xl:inline text-[11px] text-white/60">Ctrl+K</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Jump to tools and pages.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input autoFocus placeholder="Type to search…" value={q} onChange={(e) => setQ(e.target.value)} />

            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="max-h-[360px] overflow-auto divide-y divide-white/5">
                {filtered.length ? (
                  filtered.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between"
                      onClick={() => go(a.href)}
                    >
                      <div className="text-sm font-semibold text-white/90">{a.label}</div>
                      <div className="text-xs text-white/50">{a.hint ?? a.href}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-white/70">No matches.</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
