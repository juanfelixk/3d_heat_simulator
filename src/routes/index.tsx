import { createFileRoute } from "@tanstack/react-router";
import { Scene } from "@/components/Scene";
import { HUD } from "@/components/HUD";
import { ControlPanel } from "@/components/ControlPanel";
import { useSimulation } from "@/hooks/useSimulation";
import { useSolver } from "@/lib/useSolver";

export const Route = createFileRoute("/")({
  head: () => ({
      meta: [
        { title: "3D Heat Diffusion Simulator" },
        { name: "description", content: "Interactive 3D visualization of heat diffusion through a liquid heated from below." },
      ],
  }),
  component: Index,
});

function Index() {
  const { params, onChange, onReset, resetKey, hasStarted } = useSimulation();
  const { profileRef, containerProfileRef, isBoiling, meanTemp, simTime } = useSolver(params, resetKey);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <main className="relative flex-1">
        <HUD
          sourceTemp={params.sourceTemp}
          meanTemp={meanTemp}
          isBoiling={isBoiling}
          simTime={simTime}
          running={params.running}
          ambientTemp={params.initialTemp}
        />
        <Scene params={params} profileRef={profileRef} containerProfileRef={containerProfileRef} />
        <div className="pointer-events-none absolute bottom-4 left-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
          Drag to orbit · Scroll to zoom
        </div>
      </main>
      <ControlPanel params={params} onChange={onChange} onReset={onReset} hasStarted={hasStarted} />
    </div>
  );
}