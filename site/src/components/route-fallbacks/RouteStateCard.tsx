'use client';

import Link from 'next/link';

type Action = {
  href?: string;
  label: string;
  onClick?: () => void;
};

function actionClasses(primary: boolean) {
  return primary
    ? 'inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90'
    : 'inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10';
}

export default function RouteStateCard(props: {
  eyebrow?: string;
  title: string;
  message: string;
  tone?: 'neutral' | 'warn' | 'error';
  primaryAction?: Action;
  secondaryAction?: Action;
  children?: React.ReactNode;
}) {
  const tone =
    props.tone === 'error'
      ? 'border-rose-400/20 bg-rose-400/[0.08]'
      : props.tone === 'warn'
        ? 'border-amber-300/20 bg-amber-300/[0.08]'
        : 'border-white/10 bg-white/[0.04]';

  const renderAction = (action: Action | undefined, primary: boolean) => {
    if (!action) return null;
    const className = actionClasses(primary);
    if (action.href) {
      return (
        <Link href={action.href} className={className}>
          {action.label}
        </Link>
      );
    }

    return (
      <button type="button" onClick={action.onClick} className={className}>
        {action.label}
      </button>
    );
  };

  return (
    <div className="pt-20">
      <section className="mx-auto w-full max-w-4xl px-5 pb-14">
        <div className={`rounded-3xl border p-6 backdrop-blur ${tone}`}>
          {props.eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{props.eyebrow}</div> : null}
          <h1 className="mt-2 text-3xl font-bold text-white">{props.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{props.message}</p>

          {props.children ? <div className="mt-5">{props.children}</div> : null}

          {(props.primaryAction || props.secondaryAction) ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {renderAction(props.primaryAction, true)}
              {renderAction(props.secondaryAction, false)}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
