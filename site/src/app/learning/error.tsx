'use client';

import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteStateCard
      eyebrow="Something went wrong"
      title="Learning center hit an error"
      message="The learning center could not finish loading. Retry the page first."
      tone="error"
      primaryAction={{ label: 'Try again', onClick: reset }}
      secondaryAction={{ label: 'Go back', href: '/learning' }}
    />
  );
}
