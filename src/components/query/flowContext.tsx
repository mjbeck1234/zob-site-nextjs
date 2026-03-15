"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

type FlowType = 'north' | 'south';

interface FlowContextType {
    currentFlow: FlowType;
    setCurrentFlow: (flow: FlowType) => void;
    toggleFlow: () => void;
}

const FlowContext = createContext<FlowContextType | undefined>(undefined);

export function FlowProvider({ children }: { children: ReactNode }) {
    const [currentFlow, setCurrentFlow] = useState<FlowType>('south');

    const toggleFlow = () => {
        setCurrentFlow(prev => prev === 'north' ? 'south' : 'north');
    };

    const value = {
        currentFlow,
        setCurrentFlow,
        toggleFlow,
    };

    return (
        <FlowContext.Provider value={value}>
            {children}
        </FlowContext.Provider>
    );
}

export function useFlow() {
    const context = useContext(FlowContext);
    if (context === undefined) {
        throw new Error('useFlow must be used within a FlowProvider');
    }
    return context;
}