"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationPrevious,
    PaginationNext,
} from "@/components/ui/pagination";
import { LoadingListSkeleton } from "@/components/ui/loadingListSkeleton";

export function EnrouteInput() {
    const [field, setField] = useState("");
    const [area, setArea] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [enroutes, setEnroutes] = useState<any[]>([]);
    const [searchField, setSearchField] = useState("");
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 3;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = enroutes.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(enroutes.length / itemsPerPage);

    const fetchEnroutes = async (fieldToFetch: string, areaToFetch: string) => {
        setCurrentPage(1);

        if (!fieldToFetch) {
            setError("Field is required");
            return;
        }

        setLoading(true);
        setError(null);
        setEnroutes([]);

        const query = new URLSearchParams({ field: fieldToFetch });
        if (areaToFetch) query.append("area", areaToFetch);

        try {
            const response = await fetch(`/api/ids/enroutes?${query.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch enroute data");
            const data = await response.json();
            setEnroutes(data);
            setSearchField(fieldToFetch);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchEnroutes(field, area);
    };

    return (
        <div className="w-full space-y-3">
            <form onSubmit={handleSubmit}>
                <Label htmlFor="field">Field</Label>
                <Input
                    id="field"
                    type="text"
                    placeholder="e.g. BUF or KBUF"
                    value={field}
                    onChange={(e) => setField(e.target.value.toUpperCase())}
                    className="mt-2 border border-gray-300 dark:border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md"
                    required
                />

                <Label htmlFor="area" className="mt-4">
                    Area (optional)
                </Label>
                <Input
                    id="area"
                    type="text"
                    placeholder="e.g. 7"
                    value={area}
                    onChange={(e) => setArea(e.target.value.trim())}
                    className="mt-2 border border-gray-300 dark:border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-300 rounded-md"
                />

                <Button
                    type="submit"
                    className="mt-4 mb-2 w-full"
                    disabled={loading || !field}
                >
                    {loading ? "Loading..." : "Get Enroute Info"}
                </Button>
            </form>

            {error && <p className="text-red-500">{error}</p>}

            {searchField && (
                <div className="w-full border-1 border-accent-foreground rounded p-4 bg-secondary dark:bg-secondary">
                    <h2 className="text-lg font-semibold mb-4">
                        Enroute Info for {searchField}
                    </h2>

                    {loading ? (
                        <LoadingListSkeleton count={3} lines={4} />
                    ) : enroutes.length > 0 ? (
                        <>
                            <ul className="space-y-4">
                                {currentItems.map((entry, index) => (
                                    <li
                                        key={index}
                                        className="border-b border-gray-400 dark:border-gray-600 pb-4 space-y-1"
                                    >
                                        <p>
                                            <strong>Fields:</strong> {entry.fields.join(", ")}
                                        </p>
                                        <p>
                                            <strong>Qualifier:</strong> {entry.qualifier}
                                        </p>
                                        <p>
                                            <strong>Areas:</strong> {entry.areas.join(", ")}
                                        </p>
                                        <p>
                                            <strong>Rule:</strong> {entry.rule}
                                        </p>
                                    </li>
                                ))}
                            </ul>

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
                                                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
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
                        !loading &&
                        searchField && (
                            <p className="text-gray-500">
                                No enroute data found for {searchField}.
                            </p>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
