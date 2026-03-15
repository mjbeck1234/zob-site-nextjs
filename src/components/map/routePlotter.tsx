"use client";

import { useState, useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRoutePlanner } from "./routePlannerContext"
import { X } from "lucide-react"

type Fix = {
    fix: string
    lat: number
    lon: number
}

type RouteData = {
    id: string
    route: string
    fixes: Fix[]
    color: string
}

type RouteResponse = {
    route: string
    fixes: Fix[]
    errors?: string[]
}


const DEFAULT_COLORS = [
    "#FF6F00", // orange
    "#2196F3", // blue
    "#4CAF50", // green
    "#9C27B0", // purple
    "#FF5252", // red
    "#00BCD4", // cyan
    "#FFEB3B", // yellow
    "#E91E63", // pink
]

export function RoutePlanner({ map }: { map: Leaflet.Map | null }) {
    const [routeInput, setRouteInput] = useState("")
    const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0])
    const [routes, setRoutes] = useState<RouteData[]>([])
    const [loading, setLoading] = useState(false)
    const routeLayersRef = useRef<Map<string, Leaflet.LayerGroup>>(new Map())

    // Leaflet references `window` at module-eval time, so we must lazy-load it on the client.
    const leafletRef = useRef<any>(null)
    const [leafletReady, setLeafletReady] = useState(false)

    const ensureLeaflet = async () => {
        if (leafletRef.current) return leafletRef.current
        const mod: any = await import("leaflet")
        leafletRef.current = mod?.default ?? mod
        setLeafletReady(true)
        return leafletRef.current
    }

    const { dequeuedRoute, clearQueue, markRouteDisplayed, unmarkRouteDisplayed, isRouteDisplayed } = useRoutePlanner()


    // Create a route pane if it doesn't exist
    useEffect(() => {
        if (map && !map.getPane("routePane")) {
            map.createPane("routePane")
            map.getPane("routePane")!.style.zIndex = "600"
        }
    }, [map])

    // Listen for queued routes from RoutesForm
    useEffect(() => {
        if (dequeuedRoute) {
            // Keep the route exactly as returned by the route search.
            // (Older code tried to slice the first/last 4 characters for FAA routes,
            // which can accidentally delete the only endpoints and leave just an airway token,
            // resulting in "No fixes found".)
            let processedRoute = dequeuedRoute.route

            // Normalize common separators so the backend can tokenize reliably.
            processedRoute = processedRoute
                .replace(/[.,/]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()

            setRouteInput(processedRoute)
            clearQueue()

            // Automatically add the route
            handleAddRouteWithString(processedRoute)
        }
    }, [dequeuedRoute])


    // Cleanup on unmount
    useEffect(() => {
        return () => {
            routeLayersRef.current.forEach(layer => {
                if (map) map.removeLayer(layer)
            })
            routeLayersRef.current.clear()
        }
    }, [map])

    useEffect(() => {
        let mounted = true
        ensureLeaflet().then(() => {
            if (mounted) setLeafletReady(true)
        })
        return () => {
            mounted = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const plotRoute = (routeData: RouteData) => {
        const L = leafletRef.current
        if (!map || !leafletReady || !L) return

        // Remove existing layer if present
        const existingLayer = routeLayersRef.current.get(routeData.id)
        if (existingLayer) {
            map.removeLayer(existingLayer)
        }

        const layerGroup = L.layerGroup([], { pane: "routePane" })

        // Draw lines between fixes
        for (let i = 0; i < routeData.fixes.length - 1; i++) {
            const start = routeData.fixes[i]
            const end = routeData.fixes[i + 1]

            const polyline = L.polyline(
                [
                    [start.lat, start.lon],
                    [end.lat, end.lon],
                ],
                {
                    color: routeData.color,
                    weight: 3,
                    opacity: 0.8,
                    pane: "routePane",
                }
            )

            polyline.addTo(layerGroup)
        }

        // Draw markers for each fix
        routeData.fixes.forEach((fix) => {
            const marker = L.circleMarker([fix.lat, fix.lon], {
                radius: 6,
                fillColor: routeData.color,
                color: "#ffffff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9,
                pane: "routePane",
            })

            marker.bindTooltip(fix.fix, {
                permanent: false,
                direction: "top",
            })

            marker.addTo(layerGroup)
        })

        layerGroup.addTo(map)
        routeLayersRef.current.set(routeData.id, layerGroup)

        // Fit bounds to show the entire route if there are multiple fixes
        if (routeData.fixes.length > 1) {
            const bounds = L.latLngBounds(
                routeData.fixes.map((fix) => [fix.lat, fix.lon])
            )
            map.fitBounds(bounds, { padding: [50, 50] })
        }
    }

    const handleAddRouteWithString = async (routeString: string) => {
        const normalizedInput = routeString
            .replace(/[.,/]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()

        if (!normalizedInput) {
            toast.error("Please enter a route")
            return
        }

        if (isRouteDisplayed(normalizedInput)) {
            toast.warning(`Route "${normalizedInput}" is already displayed`)
            return
        }

        setLoading(true)

        try {
            const response = await fetch(
                `/api/nav/route?route=${encodeURIComponent(normalizedInput)}`
            )

            if (!response.ok) {
                throw new Error("Failed to fetch route data")
            }

            const data: RouteResponse = await response.json()

            // Display errors if any (even if the route didn't resolve)
            if (data.errors && data.errors.length > 0) {
                data.errors.forEach((error) => {
                    toast.warning(error, {
                        duration: 5000,
                    })
                })
            }

            if (!data.fixes || data.fixes.length === 0) {
                toast.error("No fixes found for this route")
                return
            }

            if (isRouteDisplayed(data.route)) {
                toast.warning(`Route "${data.route}" is already displayed`)
                return
            }

            const newRoute: RouteData = {
                id: Date.now().toString(),
                route: data.route,
                fixes: data.fixes,
                color: selectedColor,
            }

            setRoutes((prev) => [...prev, newRoute])
            markRouteDisplayed(newRoute.route)
            // Ensure Leaflet is loaded before plotting (queued routes can fire early on mount).
            await ensureLeaflet()
            plotRoute(newRoute)

            if (data.errors && data.errors.length > 0) {
                toast.warning(`Route "${data.route}" added partially / with warnings`)
            } else {
                toast.success(`Route "${data.route}" added successfully`)
            }

            // Cycle to next color
            const currentIndex = DEFAULT_COLORS.indexOf(selectedColor)
            const nextIndex = (currentIndex + 1) % DEFAULT_COLORS.length
            setSelectedColor(DEFAULT_COLORS[nextIndex])
        } catch (error) {
            console.error("Error fetching route:", error)
            toast.error("Failed to fetch route data")
        } finally {
            setLoading(false)
        }
    }



    const handleAddRoute = async () => {
        await handleAddRouteWithString(routeInput)
        setRouteInput("")
    }

    const handleRemoveRoute = (id: string) => {
        const layer = routeLayersRef.current.get(id)
        if (layer && map) {
            map.removeLayer(layer)
        }
        routeLayersRef.current.delete(id)
        const removedRoute = routes.find((r) => r.id === id)
        if (removedRoute) {
            unmarkRouteDisplayed(removedRoute.route)
        }
        setRoutes((prev) => prev.filter((r) => r.id !== id))
        toast.success("Route removed")
    }

    const handleChangeColor = (id: string, newColor: string) => {
        setRoutes((prev) =>
            prev.map((r) => {
                if (r.id === id) {
                    const updatedRoute = { ...r, color: newColor }
                    ensureLeaflet().then(() => plotRoute(updatedRoute))
                    return updatedRoute
                }
                return r
            })
        )
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="route-input">Enter Route</Label>
                <div className="flex gap-2">
                    <Input
                        id="route-input"
                        placeholder="e.g. HOXIE J70 LVZ"
                        value={routeInput}
                        onChange={(e) => setRouteInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddRoute()
                        }}
                        disabled={loading}
                    />
                    <div className="flex gap-2 items-center">
                        <input
                            type="color"
                            value={selectedColor}
                            onChange={(e) => setSelectedColor(e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer border"
                            title="Choose route color"
                        />
                        <Button onClick={handleAddRoute} disabled={loading}>
                            {loading ? "Loading..." : "Add Route"}
                        </Button>
                    </div>
                </div>
            </div>

            {routes.length > 0 && (
                <div className="space-y-2">
                    <Label>Displayed Routes</Label>
                    <div className="space-y-2 max-h-128 overflow-y-auto">
                        {routes.map((route) => (
                            <div
                                key={route.id}
                                className="flex items-center justify-between p-3 border rounded-lg bg-card"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <input
                                        type="color"
                                        value={route.color}
                                        onChange={(e) =>
                                            handleChangeColor(route.id, e.target.value)
                                        }
                                        className="w-8 h-8 rounded cursor-pointer border"
                                        title="Change color"
                                    />
                                    <span className="font-medium text-sm">
                                        {route.route}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        ({route.fixes.length} fixes)
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveRoute(route.id)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}