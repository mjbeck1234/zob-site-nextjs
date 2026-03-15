import RouteStateCard from '@/components/route-fallbacks/RouteStateCard';

export default function Loading() {
  return (
    <RouteStateCard
      eyebrow="Please wait"
      title="Loading"
      message="We’re pulling the latest page data now."
    >
      <div className="space-y-3">
        <div className="h-3 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-full max-w-2xl animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-5/6 max-w-xl animate-pulse rounded-full bg-white/10" />
      </div>
    </RouteStateCard>
  );
}
