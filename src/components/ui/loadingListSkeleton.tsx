"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface LoadingListSkeletonProps {
    count?: number; // how many skeleton items to show
    lines?: number; // how many text lines per skeleton item
}

export function LoadingListSkeleton({ count = 3, lines = 3 }: LoadingListSkeletonProps) {
    return (
        <ul className="space-y-4">
            {Array(count)
                .fill(0)
                .map((_, i) => (
                    <li
                        key={i}
                        className="border-b border-gray-300 dark:border-gray-700 pb-4 space-y-2"
                    >
                        {[...Array(lines)].map((__, j) => (
                            <Skeleton
                                key={j}
                                className={`h-4 ${
                                    j === 0
                                        ? "w-1/2"
                                        : j === 1
                                            ? "w-3/4"
                                            : "w-2/3"
                                }`}
                            />
                        ))}
                        <div className="flex gap-2 mt-2">
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                    </li>
                ))}
        </ul>
    );
}
