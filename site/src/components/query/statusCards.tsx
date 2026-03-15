"use client";

import { useState, useEffect } from "react";
import { Badge} from "@/components/ui/badge";
import {LoadingListSkeleton} from "@/components/ui/loadingListSkeleton";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";


type ParsedAtis = {
    airport: string;
    flow: string | null;
    approachType: string | null;
    metar: string | null;
    fullText: string[];
};

const AIRPORTS = ["KDTW", "KCLE", "KPIT", "KBUF"];


export function StatusCards() {
    const [data, setData] = useState<ParsedAtis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchAtis = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/ids/airportinfo");
                if (!res.ok) throw new Error("Failed to fetch ATIS data");
                const json = await res.json();
                setData(json.data.filter((d: ParsedAtis) => AIRPORTS.includes(d.airport)));
            } catch (err: any) {
                setError(err.message || "Unknown error");
            } finally {
                setLoading(false);
            }
        };
        fetchAtis();
    }, []);

    const FLOW_BADGE_MAP: Record<string, { icon: any; bg: string; text: string }> = {
        "NORTH FLOW": { icon: ArrowUp, bg: "bg-amber-500 text-black", text: "North Flow" },
        "SOUTH FLOW": { icon: ArrowDown, bg: "bg-orange-600 text-white", text: "South Flow" },
        "EAST FLOW": { icon: ArrowRight, bg: "bg-yellow-400 text-black", text: "East Flow" },
        "WEST FLOW": { icon: ArrowLeft, bg: "bg-pink-600 text-white", text: "West Flow" },
    };

    const renderBadge = (type: string | null) => {
        if (!type) return null;
        const upperType = type.toUpperCase();

        if (upperType === "ILS") {
            return <Badge key={type} className="bg-blue-600 text-white">ILS</Badge>;
        }
        if (upperType === "RNAV") {
            return <Badge key={type} className="bg-purple-600 text-white">RNAV</Badge>;
        }
        if (upperType === "VISUAL") {
            return <Badge key={type} className="bg-green-600 text-white">Visual</Badge>;
        }

        const flowBadge = FLOW_BADGE_MAP[upperType];
        if (flowBadge) {
            const Icon = flowBadge.icon;
            return (
                <Badge key={type} className={`flex items-center gap-1 ${flowBadge.bg}`}>
                    {Icon && <Icon size={16} />}
                    {flowBadge.text}
                </Badge>
            );
        }

        return <Badge key={type}>{type}</Badge>;
    };

    return (
        <div className="w-full space-y-6">
            {loading ? (
                <LoadingListSkeleton count={4} lines={4} />
            ) : error ? (
                <p className="text-red-500">Error: {error}</p>
            ) : (
                data.map((atis) => {
                    const combinedText = atis.fullText.join(" ");
                    const truncatedText =
                        combinedText.length > 100
                            ? combinedText.slice(0, 150) + "..."
                            : combinedText;

                    const isExpanded = expandedEntries[atis.airport] || false;

                    return (
                        <div
                            key={atis.airport}
                            className="w-full border border-accent-foreground rounded p-4 bg-secondary dark:bg-secondary"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-lg font-semibold">{atis.airport}</h2>
                                <div className="flex flex-wrap gap-2">
                                    {renderBadge(atis.approachType)}
                                    {renderBadge(atis.flow)}
                                </div>
                            </div>
                            {atis.metar && (
                                <p className="mb-2">
                                    <strong>METAR:</strong> <br></br> {atis.metar}
                                </p>
                            )}
                            <p>
                                <strong className="mb-2">ATIS:</strong> <br></br> {" "}
                                {isExpanded ? combinedText : truncatedText}{" "}
                                {combinedText.length > 100 && (
                                    <button
                                        type="button"
                                        className="text-blue-500 underline ml-1"
                                        onClick={() =>
                                            setExpandedEntries((prev) => ({
                                                ...prev,
                                                [atis.airport]: !prev[atis.airport],
                                            }))
                                        }
                                    >
                                        {isExpanded ? "Read less" : "Read more"}
                                    </button>
                                )}
                            </p>
                        </div>
                    );
                })
            )}
        </div>
    );
}
