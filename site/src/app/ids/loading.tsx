import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function Loading() {
  return <RouteStateCard eyebrow="Loading" title="Loading IDS" message="Starting the IDS view and pulling its latest data." />;
}
