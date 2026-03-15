"use client"

import { createContext, useContext, useRef, useState, ReactNode } from "react"

type RouteToPlot = {
    route: string
    source: "faa" | "custom"
}

type RoutePlannerContextType = {
    queueRoute: (route: RouteToPlot) => boolean
    dequeuedRoute: RouteToPlot | null
    clearQueue: () => void
    markRouteDisplayed: (route: string) => void
    unmarkRouteDisplayed: (route: string) => void
    isRouteDisplayed: (route: string) => boolean
}

const RoutePlannerContext = createContext<RoutePlannerContextType | null>(null)

function normalizeRouteKey(route: string | null | undefined) {
    return String(route ?? "")
        .replace(/[.,/]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase()
}

export function RoutePlannerProvider({ children }: { children: ReactNode }) {
    const [queuedRoute, setQueuedRoute] = useState<RouteToPlot | null>(null)
    const displayedRouteKeysRef = useRef<Set<string>>(new Set())

    const isRouteDisplayed = (route: string) => {
        const key = normalizeRouteKey(route)
        return !!key && displayedRouteKeysRef.current.has(key)
    }

    const markRouteDisplayed = (route: string) => {
        const key = normalizeRouteKey(route)
        if (key) displayedRouteKeysRef.current.add(key)
    }

    const unmarkRouteDisplayed = (route: string) => {
        const key = normalizeRouteKey(route)
        if (key) displayedRouteKeysRef.current.delete(key)
    }

    const queueRoute = (route: RouteToPlot) => {
        const nextKey = normalizeRouteKey(route?.route)
        const queuedKey = normalizeRouteKey(queuedRoute?.route)
        if (!nextKey) return false
        if (displayedRouteKeysRef.current.has(nextKey) || queuedKey === nextKey) {
            return false
        }
        setQueuedRoute(route)
        return true
    }

    const clearQueue = () => {
        setQueuedRoute(null)
    }

    return (
        <RoutePlannerContext.Provider
            value={{
                queueRoute,
                dequeuedRoute: queuedRoute,
                clearQueue,
                markRouteDisplayed,
                unmarkRouteDisplayed,
                isRouteDisplayed,
            }}
        >
            {children}
        </RoutePlannerContext.Provider>
    )
}


export function useOptionalRoutePlanner() {
    return useContext(RoutePlannerContext)
}
export function useRoutePlanner() {
    const context = useContext(RoutePlannerContext)
    if (!context) {
        throw new Error("useRoutePlanner must be used within RoutePlannerProvider")
    }
    return context
}
