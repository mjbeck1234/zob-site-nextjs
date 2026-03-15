import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function NotFound() {
  return (
    <RouteStateCard
      eyebrow="Not found"
      title="That page does not exist"
      message="The link may be outdated, or the page may have moved."
      tone="warn"
      primaryAction={{ label: 'Back home', href: '/' }}
      secondaryAction={{ label: 'Browse events', href: '/events' }}
    />
  );
}
