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
import { LoadingListSkeleton } from "@/components/ui/loadingListSkeleton";

export function CrossingsInput() {
    const [inputValue, setInputValue] = useState("");
    const [submittedDestination, setSubmittedDestination] = useState("");
    const [crossings, setCrossings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 3; 
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = crossings.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(crossings.length / itemsPerPage);

    const fetchCrossings = async (destinationToFetch: string) => {
        setLoading(true);
        setError(null);
        setCrossings([]);
        setCurrentPage(1);

        try {
            const response = await fetch(
                `/api/ids/crossings?field=${destinationToFetch}`
            );
            if (!response.ok) throw new Error("Failed to fetch crossings");
            const data = await response.json();
            setCrossings(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedDestination(inputValue);
        fetchCrossings(inputValue);
    };

    const getArtccColor = (artcc: string) => {
        const map: Record<string, string> = {
            ZNY: "bg-blue-700 text-white",
            ZBW: "bg-purple-700 text-white",
            ZOB: "bg-emerald-700 text-white",
            ZAU: "bg-rose-700 text-white",
            ZDC: "bg-orange-600 text-white",
            ZTL: "bg-green-700 text-white",
            ZJX: "bg-cyan-700 text-white",
            ZMA: "bg-yellow-600 text-black",
            ZHU: "bg-red-700 text-white",
            ZFW: "bg-fuchsia-700 text-white",
            ZLC: "bg-sky-700 text-white",
            ZDV: "bg-amber-700 text-white",
            ZLA: "bg-indigo-700 text-white",
            ZOA: "bg-teal-700 text-white",
            ZSE: "bg-pink-600 text-white",
            ZAB: "bg-lime-700 text-white",
        };
        return map[artcc] || "bg-gray-600 text-white";
    };

    return (
        <div className="w-full space-y-3">
            {/* Form Section */}
            <form onSubmit={handleSubmit}>
                <Label htmlFor="destination">Destination</Label>
                <Input
                    id="destination"
                    type="text"
                    placeholder="e.g. EWR or KEWR"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                    className="mt-2 border border-gray-300 dark:border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md"
                />

                <Button
                    type="submit"
                    className="mt-4 mb-2 w-full"
                    disabled={loading || !inputValue}
                >
                    {loading ? "Loading..." : "Get Crossings"}
                </Button>
            </form>

            {/* Results Section */}
            {submittedDestination && (
                <div className="w-full border border-accent-foreground rounded p-4 bg-secondary dark:bg-secondary">
                    <h2 className="text-lg font-semibold mb-4">
                        External LOAs for {submittedDestination}
                    </h2>

                    {/* Error */}
                    {error && <p className="text-red-500 mb-4">Error: {error}</p>}

                    {/* Loading */}
                    {loading ? (
                        <LoadingListSkeleton count={3} lines={3} />
                    ) : currentItems.length > 0 ? (
                        <>
                            <ul className="space-y-4">
                                {currentItems.map((crossing, index) => (
                                    <li key={index} className="border-b border-gray-400 dark:border-gray-600 pb-4 space-y-1">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {crossing.artcc_receiving && (
                                                <Badge
                                                    variant="default"
                                                    className={getArtccColor(crossing.artcc_receiving)}
                                                >
                                                    {crossing.artcc_receiving}
                                                </Badge>
                                            )}
                                            {crossing.notes?.toLowerCase().includes("rnav") &&
                                                !crossing.notes?.toLowerCase().includes("non-rnav") && (
                                                    <Badge variant="default" className="bg-amber-700 text-white">
                                                        RNAV
                                                    </Badge>
                                                )}
                                            {crossing.notes?.toLowerCase().includes("non-rnav") && (
                                                <Badge variant="default" className="bg-lime-800 text-white">
                                                    Non-RNAV
                                                </Badge>
                                            )}
                                            {crossing.notes?.toLowerCase().includes("prop") && (
                                                <Badge variant="default" className="bg-green-500 text-black">
                                                    Prop
                                                </Badge>
                                            )}
                                            {crossing.notes?.toLowerCase().includes("jet") && (
                                                <Badge variant="default" className="bg-pink-700 text-white">
                                                    Jet
                                                </Badge>
                                            )}
                                        </div>
                                        <p>
                                            <strong>Fix:</strong> {crossing.fix || "None"}
                                        </p>
                                        <p>
                                            <strong>Restriction:</strong> {crossing.restriction || "N/A"}
                                        </p>
                                        <p>
                                            <strong>Notes:</strong> {crossing.notes || "N/A"}
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
                                                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                            />
                                        </PaginationItem>
                                        <PaginationItem>
                                            <PaginationNext
                                                onClick={() =>
                                                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                                                }
                                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            )}
                        </>
                    ) : (
                        <p className="text-gray-500">
                            No crossings found for {submittedDestination}.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
