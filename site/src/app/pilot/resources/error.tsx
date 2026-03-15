'use client';

import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteStateCard
      eyebrow="Something went wrong"
      title="Pilot resources hit an error"
      message="The briefing content or map overlays did not finish loading. Try the page again."
      tone="error"
      primaryAction={{ label: 'Try again', onClick: reset }}
      secondaryAction={{ label: 'Go back', href: '/pilot/resources' }}
    />
  );
}
