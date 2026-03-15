'use client';

import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <RouteStateCard
          eyebrow="Something went wrong"
          title="This page hit an error"
          message="Try again first. If it keeps happening, head back home and reload the section from there."
          tone="error"
          primaryAction={{ label: 'Try again', onClick: reset }}
          secondaryAction={{ label: 'Back home', href: '/' }}
        />
      </body>
    </html>
  );
}
