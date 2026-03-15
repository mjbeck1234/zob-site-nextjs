'use client';

import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteStateCard
      eyebrow="Something went wrong"
      title="IDS hit an error"
      message="Some IDS data or map layers failed to load. Retry the page first."
      tone="error"
      primaryAction={{ label: 'Try again', onClick: reset }}
      secondaryAction={{ label: 'Go back', href: '/ids' }}
    />
  );
}
