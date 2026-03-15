'use client';

import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteStateCard
      eyebrow="Something went wrong"
      title="Event details hit an error"
      message="The event page did not finish loading correctly. Retry it, or go back to the events list."
      tone="error"
      primaryAction={{ label: 'Try again', onClick: reset }}
      secondaryAction={{ label: 'Go back', href: '/events' }}
    />
  );
}
