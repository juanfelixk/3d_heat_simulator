import { useState, useCallback, useRef } from "react";
import type { SimParams } from "@/components/ControlPanel";

const DEFAULT_PARAMS: SimParams = {
    initialTemp: 25,
    sourceTemp: 180,
    ambientTemp: 25,
    containerMaterial: "stainless_steel",
    liquid: "water",
    airCondition: "still",
    heatSourceSize: "full",
    speed: 1.0,
    running: false,
    showContainerHeat: false,
};

export function useSimulation() {
    const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
    const [resetKey, setResetKey] = useState(0);
    const [hasStarted, setHasStarted] = useState(false);
    const hasStartedRef = useRef(false);

    const onChange = useCallback((patch: Partial<SimParams>) => {
        if (patch.running === true && !hasStartedRef.current) {
            hasStartedRef.current = true;
            setHasStarted(true);
            setResetKey((k) => k + 1); // full reset
        }
        setParams((prev) => ({ ...prev, ...patch }));
    }, []);

    const onReset = useCallback(() => {
        setParams(DEFAULT_PARAMS);
        setResetKey((k) => k + 1);
        setHasStarted(false);
        hasStartedRef.current = false;
    }, []);

    return { params, onChange, onReset, resetKey, hasStarted };
}