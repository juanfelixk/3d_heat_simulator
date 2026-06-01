import { Play, Pause, RotateCcw } from "lucide-react";
import { CONTAINER_MATERIALS, LIQUID_MATERIALS, AIR_CONDITIONS, HEAT_SOURCE_SIZES } from "@/lib/materials";
import React, { memo } from "react";

interface SelectFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: Record<string, { label: string }>;
    disabled?: boolean;
}

function SelectField({ label, value, onChange, options, disabled }: SelectFieldProps) {
    return (
        <label className={`flex flex-col gap-1.5 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
            </span>
            <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full rounded-md border border-border bg-input/60 px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary">
                {Object.entries(options).map(([key, { label }]) => (
                    <option key={key} value={key}>
                        {label}
                    </option>
                ))}
            </select>
        </label>
    );
}

interface ParamFieldProps {
    label: string;
    unit?: string;
    value: number;
    onChange: (v: number) => void;
    step?: number;
    min?: number;
    max?: number;
    disabled?: boolean;
}

function ParamField({ label, unit, value, onChange, step = 1, min, max, disabled }: ParamFieldProps) {
    return (
        <label className={`flex flex-col gap-1.5 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
                </span>
                {unit && (
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                        {unit}
                    </span>
                )}
            </div>
            <input type="number" value={value} step={step} min={min} max={max} onChange={(e) => onChange(parseFloat(e.target.value))} disabled={disabled}
                className="w-full rounded-md border border-border bg-input/60 px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
        </label>
    );
}

interface SliderFieldProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    displaySuffix?: string;
}

function SliderField({ label, value, onChange, min = 0, max = 1, step = 0.01, displaySuffix = "x" }: SliderFieldProps) {
    return (
        <label className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
                </span>
                <span className="font-mono text-xs text-foreground">
                {value.toFixed(2)}{displaySuffix}
                </span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="accent-primary" />
        </label>
    );
}

function Section({ title, children }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mb-6">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                {title}
            </div>
            <div className="flex flex-col gap-4">{children}</div>
        </div>
    );
}

export interface SimParams {
    initialTemp: number;
    sourceTemp: number;
    ambientTemp: number;
    containerMaterial: string;
    liquid: string;
    airCondition: string;
    heatSourceSize: string;
    speed: number;
    running: boolean;
    showContainerHeat: boolean;
}

interface ControlPanelProps {
    params: SimParams;
    onChange: (patch: Partial<SimParams>) => void;
    onReset: () => void;
    hasStarted: boolean;
}

export const ControlPanel = memo(function ControlPanel({ params, onChange, onReset, hasStarted }: ControlPanelProps) {
    const { initialTemp, sourceTemp, ambientTemp, containerMaterial, liquid, airCondition, heatSourceSize, speed, running, showContainerHeat } = params;

    return (
        <aside className="flex h-full w-85 shrink-0 flex-col border-l border-border bg-surface/80 backdrop-blur-xl">
            <div className="border-b border-border px-5 py-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Parameters
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                Simulation Control
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
                <Section title="Thermal Boundaries">
                    <ParamField
                        label="Initial Liquid Temperature"
                        unit="°C"
                        value={initialTemp}
                        disabled={hasStarted}
                        onChange={(v) => onChange({ initialTemp: v })}
                    />
                    <ParamField
                        label="Heat Source Temperature"
                        unit="°C"
                        value={sourceTemp}
                        onChange={(v) => onChange({ sourceTemp: v })}
                        min={0}
                        max={600}
                    />
                    <ParamField
                        label="Room Temperature"
                        unit="°C"
                        value={ambientTemp}
                        onChange={(v) => onChange({ ambientTemp: v })}
                    />
                </Section>

                <Section title="Properties">
                    <SelectField
                        label="Container Material"
                        value={containerMaterial}
                        onChange={(v) => onChange({ containerMaterial: v })}
                        options={CONTAINER_MATERIALS}
                        disabled={hasStarted}
                    />
                    <div className="flex items-center gap-2 pl-0.5">
                        <input
                            id="show-container-heat"
                            type="checkbox"
                            checked={showContainerHeat}
                            onChange={(e) => onChange({ showContainerHeat: e.target.checked })}
                            className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                        />
                        <label htmlFor="show-container-heat" className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground select-none cursor-pointer">
                            Show diffusion pattern in container
                        </label>
                    </div>
                    <SelectField
                        label="Liquid"
                        value={liquid}
                        onChange={(v) => onChange({ liquid: v })}
                        options={LIQUID_MATERIALS}
                        disabled={hasStarted}
                    />
                    <SelectField
                        label="Surrounding Air"
                        value={airCondition}
                        onChange={(v) => onChange({ airCondition: v })}
                        options={AIR_CONDITIONS}
                    />
                    <SelectField
                        label="Heat Source Size"
                        value={heatSourceSize}
                        onChange={(v) => onChange({ heatSourceSize: v })}
                        options={HEAT_SOURCE_SIZES}
                        disabled={hasStarted}
                    />
                </Section>

                <Section title="Simulation">
                    <SliderField
                        label="Simulation Speed"
                        value={speed}
                        onChange={(v) => onChange({ speed: v })}
                        min={0.5}
                        max={5}
                        step={0.1}
                    />
                    </Section>
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-4">
                <button onClick={() => onChange({ running: !running })} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer">
                    {running ? (
                        <Pause className="h-3.5 w-3.5" />
                    ) : (
                        <Play className="h-3.5 w-3.5" />
                    )}
                    {running ? "Pause" : "Run"}
                </button>
                <button onClick={onReset} className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent cursor-pointer">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                </button>
            </div>
        </aside>
    );
});