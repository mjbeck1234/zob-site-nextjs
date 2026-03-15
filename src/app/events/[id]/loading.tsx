import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function Loading() {
  return <RouteStateCard eyebrow="Loading" title="Loading event details" message="Pulling the latest event information, positions, and signup data." />;
}
