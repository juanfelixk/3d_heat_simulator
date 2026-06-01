import { memo } from "react";

interface ChipProps {
    label: string;
    value: string;
    tone?: "neutral" | "warm" | "hot";
}

function Chip({ label, value, tone = "neutral" }: ChipProps) {
    const dot =
        tone === "hot"
        ? "bg-thermal-hot"
        : tone === "warm"
            ? "bg-thermal-warm"
            : "bg-thermal-cool";

    return (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated/60 px-2.5 py-1.5 backdrop-blur-md">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            <span className="font-mono text-xs text-foreground">{value}</span>
        </div>
    );
}

function formatTime(totalSeconds: number): string {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
}

interface HUDProps {
    sourceTemp?: number;
    meanTemp?: number;
    isBoiling?: boolean;
    simTime?: number;
    running?: boolean;
    ambientTemp?: number;
}

interface ColorBarProps {
    minTemp: number;
    maxTemp: number;
}

function ColorBar({ minTemp, maxTemp }: ColorBarProps) {
    const mid = Math.round((minTemp + maxTemp) / 2);
    return (
        <div className="pointer-events-none absolute right-6 top-6 z-10 flex items-stretch gap-2">
            <div className="flex flex-col justify-between py-0.5 text-right">
                <span className="font-mono text-[10px] text-muted-foreground">{maxTemp}°C</span>
                <span className="font-mono text-[10px] text-muted-foreground">{mid}°C</span>
                <span className="font-mono text-[10px] text-muted-foreground">{minTemp}°C</span>
            </div>
            <div className="w-3 rounded-sm" style={{ height: 120, background: "linear-gradient(to top, #000000 0%, #ff8c0d 50%, #ff1400 100%)" }} />
        </div>
    );
}

export const HUD = memo(function HUD({ sourceTemp = 180, meanTemp = 42.7, isBoiling = false, simTime = 0, running = false, ambientTemp = 25 }: HUDProps) {
    return (
        <>
            <div className="pointer-events-none absolute left-6 top-6 z-10 flex flex-col gap-3">
                <div className="gap-0!">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        3D Liquid Heat Diffusion Simulator
                    </h1>
                    <p className="font-mono text-xs text-muted-foreground text-left">
                        3D visualization of conductive heat transfer from a planar source through a viscous medium.
                    </p>
                </div>

                {/* Live stat chips */}
                <div className="pointer-events-auto mt-2 flex flex-wrap gap-2">
                    <Chip label="Source" value={`${sourceTemp} °C`} tone="hot" />
                    <Chip label="Mean" value={`${meanTemp.toFixed(1)} °C`} tone="warm" />
                    {/* Time chip: always visible, dims when paused */}
                    <div className={`flex items-center gap-2 rounded-md border border-border bg-surface-elevated/60 px-2.5 py-1.5 backdrop-blur-md transition-opacity ${running ? "opacity-100" : "opacity-50"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-thermal-cool animate-pulse" : "bg-thermal-cool"}`} />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Time
                        </span>
                        <span className="font-mono text-xs text-foreground tabular-nums">
                            {formatTime(simTime)}
                        </span>
                    </div>
                    {isBoiling && (
                        <Chip label="Boiling Point" value="BP reached" tone="hot" />
                    )}
                </div>
            </div>

            <ColorBar minTemp={ambientTemp} maxTemp={Math.max(sourceTemp, ambientTemp + 1)} />
        </>
    );
});