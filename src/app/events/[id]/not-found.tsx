import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function EventNotFound() {
  return (
    <RouteStateCard
      eyebrow="Event not found"
      title="That event could not be found"
      message="It may have been removed, or the link may be outdated."
      tone="warn"
      primaryAction={{ label: 'Back to events', href: '/events' }}
      secondaryAction={{ label: 'Back home', href: '/' }}
    />
  );
}
