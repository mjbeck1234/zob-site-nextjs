import React from 'react';
import Breadcrumbs, { Crumb } from '@/components/Breadcrumbs';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  right?: React.ReactNode;
  /** Alias for `right` used by some pages */
  actions?: React.ReactNode;
  /** Use the full viewport width (no max-width constraints). */
  fullWidth?: boolean;
  children: React.ReactNode;
};

export default function PageShell({ title, subtitle, crumbs, right, actions, fullWidth, children }: Props) {
  const c = crumbs ?? [{ href: '/', label: 'Home' }, { label: title }];
  const rhs = right ?? actions;
  const maxW = fullWidth ? 'max-w-none' : 'max-w-6xl';

  return (
    <div className="pt-20">
      {/* Hero header */}
      <section className={cn('mx-auto w-full px-5 pb-10', maxW)}>
        <Breadcrumbs crumbs={c} />

        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
                {subtitle}
              </p>
            ) : null}
          </div>

          {rhs ? <div className="flex flex-wrap gap-2">{rhs}</div> : null}
        </div>
      </section>

      {/* Content */}
      <section className={cn('mx-auto w-full px-5 pb-14', maxW)}>{children}</section>
    </div>
  );
}
