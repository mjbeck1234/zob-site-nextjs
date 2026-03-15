'use client';

import { useEffect, useMemo, useState } from 'react';

function relLabel(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'live';
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export default function LiveFreshness(props: {
  sinceIso: string;
  prefix?: string;
  className?: string;
}) {
  const { sinceIso, prefix = 'Updated', className = '' } = props;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const text = useMemo(() => relLabel(sinceIso), [sinceIso, tick]);

  return <span className={className}>{prefix} {text}</span>;
}
