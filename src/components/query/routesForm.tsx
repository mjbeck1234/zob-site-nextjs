"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationPrevious,
    PaginationNext,
} from "@/components/ui/pagination";
import { LoadingListSkeleton} from "@/components/ui/loadingListSkeleton";
import {useRoutePlanner} from "@/components/map/routePlannerContext";
import {MapPin} from "lucide-react";

export function RoutesForm() {
    const [routeOrigin, setRouteOrigin] = useState("");
    const [routeDestination, setRouteDestination] = useState("");
    const [submittedRouteOrigin, setSubmittedRouteOrigin] = useState("");
    const [submittedRouteDestination, setSubmittedRouteDestination] = useState("");
    const [routes, setRoutes] = useState<any[]>([]);
    const [routesError, setRoutesError] = useState<string | null>(null);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 3;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentRoutes = routes.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(routes.length / itemsPerPage);

    const { queueRoute } = useRoutePlanner()

    const fetchRoutes = async () => {
        setRoutesLoading(true);
        setRoutesError(null);
        setRoutes([]);
        setCurrentPage(1);

        try {
            const response = await fetch(
                `/api/ids/routes?dep=${routeOrigin}&dest=${routeDestination}`
            );
            if (!response.ok) throw new Error("Failed to fetch routes");
            const data = await response.json();
            setRoutes(data);
        } catch (err) {
            setRoutesError((err as Error).message);
        } finally {
            setRoutesLoading(false);
        }
    };

    const handlePlotRoute = (route: any) => {
        queueRoute({
            route: route.route,
            source: route.source
        })
    }


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedRouteOrigin(routeOrigin);
        setSubmittedRouteDestination(routeDestination);
        fetchRoutes();
    };

    return (
        <div className="w-full space-y-3">
            <form onSubmit={handleSubmit}>
                <Label htmlFor="routeOrigin">Route Origin</Label>
                <Input
                    id="routeOrigin"
                    type="text"
                    placeholder="e.g. DTW or KDTW"
                    value={routeOrigin}
                    onChange={(e) => setRouteOrigin(e.target.value.toUpperCase())}
                    className="mt-2 border border-gray-300 dark:border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md"
                    required
                />

                <Label htmlFor="routeDestination" className="mt-4">
                    Route Destination
                </Label>
                <Input
                    id="routeDestination"
                    type="text"
                    placeholder="e.g. ORD or KORD"
                    value={routeDestination}
                    onChange={(e) => setRouteDestination(e.target.value.toUpperCase())}
                    className="mt-2 border border-gray-300 dark:border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md"
                    required
                />

                <Button
                    type="submit"
                    className="mt-4 mb-2 w-full"
                    disabled={routesLoading || !routeOrigin || !routeDestination}
                >
                    {routesLoading ? "Loading..." : "Get Routes"}
                </Button>
            </form>

            {routesError && <p className="text-red-500">{routesError}</p>}

            {/* Results Section */}
            {submittedRouteOrigin && submittedRouteDestination && (
                <div className="w-full border border-accent-foreground rounded p-4 bg-secondary dark:bg-secondary">
                    <h2 className="text-lg font-semibold mb-4">
                        Routes from {submittedRouteOrigin} to {submittedRouteDestination}
                    </h2>

                    {/* Loading Skeletons */}
                    {routesLoading ? (
                        <LoadingListSkeleton count={3} />
                    ) : routes.length > 0 ? (
                        <>
                            <ul className="space-y-4">
                                {currentRoutes.map((route, index) => (
                                    <li key={index} className="border-b border-gray-400 dark:border-gray-600 pb-4 space-y-1">
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {route.source === "faa" && (
                                                <Badge variant="default" className="bg-brand-slate text-white">
                                                    FAA Preferred Route
                                                </Badge>
                                            )}
                                            {route.isEvent && (
                                                <Badge variant="default" className="bg-fuchsia-500 text-white">
                                                    Event Route
                                                </Badge>
                                            )}
                                            {route.isActive && route.hasFlows && (
                                                <Badge variant="default" className="bg-green-700 text-white">
                                                    Route Active for RW Flow
                                                </Badge>
                                            )}
                                            {route.notes?.toLowerCase().includes("rnav") && (
                                                <Badge variant="default" className="bg-rose-700 text-white">
                                                    RNAV
                                                </Badge>
                                            )}
                                            {route.notes?.toLowerCase().includes("north") && (
                                                <Badge variant="default" className="bg-amber-400 text-black">
                                                    {route.dest} North Flow
                                                </Badge>
                                            )}
                                            {route.notes?.toLowerCase().includes("south") && (
                                                <Badge variant="default" className="bg-fuchsia-700 text-white">
                                                    {route.dest} South Flow
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <p className="mb-0">
                                                <strong>Route:</strong> {route.route}
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={() => handlePlotRoute(route)}
                                            >
                                                <MapPin className="h-4 w-4" />
                                                Plot on Map
                                            </Button>
                                        </div>
                                        <p>
                                            <strong>Altitude:</strong> {route.altitude || "N/A"}
                                        </p>
                                        <p>
                                            <strong>Notes:</strong> {route.notes || "N/A"}
                                        </p>
                                    </li>
                                ))}
                            </ul>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <Pagination className="mt-4">
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious
                                                onClick={() =>
                                                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                                                }
                                                className={
                                                    currentPage === 1
                                                        ? "pointer-events-none opacity-50"
                                                        : ""
                                                }
                                            />
                                        </PaginationItem>
                                        <PaginationItem>
                                            <PaginationNext
                                                onClick={() =>
                                                    setCurrentPage((prev) =>
                                                        Math.min(prev + 1, totalPages)
                                                    )
                                                }
                                                className={
                                                    currentPage === totalPages
                                                        ? "pointer-events-none opacity-50"
                                                        : ""
                                                }
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            )}
                        </>
                    ) : (
                        !routesLoading && (
                            <p className="text-gray-500">
                                No routes found from {submittedRouteOrigin} to{" "}
                                {submittedRouteDestination}.
                            </p>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

// Backwards-compat / naming consistency with other query components
// (EnrouteInput, CrossingsInput, etc.)
export { RoutesForm as RoutesInput };
