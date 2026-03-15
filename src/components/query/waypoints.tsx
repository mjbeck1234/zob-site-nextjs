
"use client";

// (no React hooks needed in this module)
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Navigation } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useFlow } from "@/components/query/flowContext";
// Use a relative import to avoid any TS path-alias differences between environments.
import waypointsData from "../../data/jsons/static/waypoints.json";

type WaypointData = {
    sid: string;
    gate: string;
    prefRwys: string[];
    rotg: Record<string, string>;
};

type MetroSidData = {
    name: string;
    type: string;
    headings: Record<string, string>;
};

type WaypointsJson = {
    dtwrotg: WaypointData[];
    metrosid: MetroSidData[];
};

const WAYPOINTS_DATA: WaypointsJson = waypointsData;

export function Waypoints() {
    const { currentFlow, toggleFlow } = useFlow();

    // Define runway sets by flow
    const SOUTH_FLOW_RUNWAYS = ['22R', '22L', '21R', '21L'];
    const NORTH_FLOW_RUNWAYS = ['04L', '04R', '03L', '03R'];


    const renderFlowBadge = (flow: 'north' | 'south', onClick: () => void) => {
        if (flow === 'north') {
            return (
                <Badge
                    className="bg-amber-500 text-black flex items-center gap-1 cursor-pointer hover:bg-amber-600 transition-colors"
                    onClick={onClick}
                >
                    <ArrowUp size={16} />
                    North Flow
                </Badge>
            );
        } else {
            return (
                <Badge
                    className="bg-orange-600 text-white flex items-center gap-1 cursor-pointer hover:bg-orange-700 transition-colors"
                    onClick={onClick}
                >
                    <ArrowDown size={16} />
                    South Flow
                </Badge>
            );
        }
    };

    const getActiveRunways = () => {
        return currentFlow === 'south' ? SOUTH_FLOW_RUNWAYS : NORTH_FLOW_RUNWAYS;
    };

    const getRunwayWaypoint = (waypoint: WaypointData, runway: string): string => {
        if (runway === '21L' || runway === '21R') {
            return waypoint.rotg['21R/L'] || waypoint.rotg[runway] || '';
        }
        return waypoint.rotg[runway] || '';
    };

    const isPreferredRunway = (waypoint: WaypointData, runway: string): boolean => {
        return waypoint.prefRwys.includes(runway) ||
            waypoint.prefRwys.some(pref => pref.includes(runway.replace(/[LRC]/, '')));
    };

    const renderSidTable = () => {
        const activeRunways = getActiveRunways();

        return (
            <div className="border border-accent-foreground rounded p-4 bg-secondary dark:bg-secondary">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Navigation size={18} />
                        <h3 className="text-lg font-semibold">DTW ROTG SIDs</h3>
                    </div>

                    {/* Flow toggle belongs in the card header (top-right) */}
                    <div className="flex items-center gap-2">
                        {renderFlowBadge(currentFlow, toggleFlow)}
                    </div>
                </div>

                <div className="space-y-0">
                    {/* Header Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 pb-2 text-sm font-medium border-b border-accent-foreground">
                        <div>SID</div>
                        {activeRunways.map(runway => (
                            <div key={runway} className="text-center">{runway}</div>
                        ))}
                    </div>

                    {/* Data Rows */}
                    {WAYPOINTS_DATA.dtwrotg.map((waypoint, index) => (
                        <div key={waypoint.sid}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 py-2 text-sm">
                                <div className="font-medium">
                                    {waypoint.sid}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        ({waypoint.gate})
                                    </span>
                                </div>
                                {activeRunways.map(runway => {
                                    const waypointText = getRunwayWaypoint(waypoint, runway);
                                    const isPreferred = isPreferredRunway(waypoint, runway);

                                    return (
                                        <div
                                            key={runway}
                                            className={`text-center ${
                                                isPreferred
                                                    ? "text-green-500 dark:text-green-600 font-bold"
                                                    : "text-gray-600 dark:text-gray-400"
                                            }`}
                                        >
                                            {waypointText}
                                        </div>
                                    );
                                })}
                            </div>
                            {index < WAYPOINTS_DATA.dtwrotg.length - 1 && (
                                <Separator className="my-2" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderMetroSidTable = () => {
        const activeRunways = getActiveRunways();
        const filteredMetroSids = WAYPOINTS_DATA.metrosid.filter(metroSid =>
            activeRunways.some(runway => metroSid.headings[runway])
        );

        if (filteredMetroSids.length === 0) return null;

        return (
            <div className="border border-accent-foreground rounded p-4 bg-secondary dark:bg-secondary">
                <div className="flex items-center gap-2 mb-4">
                    <Navigation size={18} />
                    <h3 className="text-lg font-semibold">Metro SID Headings</h3>
                </div>

                <div className="space-y-0">
                    {/* Header Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 pb-2 text-sm font-medium border-b border-accent-foreground">
                        <div>SID</div>
                        {activeRunways.map(runway => (
                            <div key={runway} className="text-center">{runway}</div>
                        ))}
                    </div>

                    {/* Data Rows */}
                    {filteredMetroSids.map((metroSid, index) => (
                        <div key={metroSid.type}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 py-2 text-sm">
                                <div className="font-medium">
                                    {metroSid.type}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        ({metroSid.name.replace(metroSid.type, '').trim()})
                                    </span>
                                </div>
                                {activeRunways.map(runway => {
                                    const heading = metroSid.headings[runway] || '';

                                    return (
                                        <div
                                            key={runway}
                                            className="text-center text-foreground"
                                        >
                                            {heading}
                                        </div>
                                    );
                                })}
                            </div>
                            {index < filteredMetroSids.length - 1 && (
                                <Separator className="my-2" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full space-y-6">
            <div className="space-y-6">
                {renderSidTable()}
                {/*{renderMetroSidTable()}*/}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mt-6">
                Showing waypoints for {currentFlow} flow configuration.
                {currentFlow === 'south'
                    ? ' South flow uses runways 21R/L, 22L, 22R.'
                    : ' North flow uses runways 03L, 03R, 04R, 04L.'}
            </div>
        </div>
    );

}