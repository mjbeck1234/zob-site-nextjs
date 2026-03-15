import Link from 'next/link';

export type Crumb = { href?: string; label: string };

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur">
      <span className="h-2 w-2 rounded-full bg-white/40" />
      {crumbs.map((c, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={`${c.label}-${idx}`} className="inline-flex items-center gap-2">
            {c.href && !isLast ? (
              <Link href={c.href} className="text-white/80 hover:text-white no-underline">
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-semibold text-white' : 'text-white/80'}>{c.label}</span>
            )}
            {!isLast ? <span className="text-white/35">→</span> : null}
          </span>
        );
      })}
    </div>
  );
}
