import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, ContactShadows } from "@react-three/drei";
import { Container } from "./Container";
import { Liquid } from "./Liquid";
import { HeatSource } from "./HeatSource";
import type { SimParams } from "./ControlPanel";
import { CONTAINER_MATERIALS, HEAT_SOURCE_SIZES, LIQUID_MATERIALS } from "@/lib/materials";
import type { ContainerProfile } from "@/lib/useSolver";

const W = 2.2;
const H = 1.6;
const D = 2.2;

function tempToIntensity(t: number) {
  return Math.min(Math.max(t / 300, 0), 1);
}

interface SceneProps {
  params: SimParams;
  profileRef: React.MutableRefObject<Float32Array<ArrayBuffer>>;
  containerProfileRef: React.MutableRefObject<ContainerProfile>;
}

export function Scene({ params, profileRef, containerProfileRef }: SceneProps) {
  const plateY = -H / 2 - 0.08;
  const intensity = tempToIntensity(params.sourceTemp);

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMappingExposure: 1.1 }} camera={{ position: [4.5, 3.2, 5.2], fov: 38 }}>
      <color attach="background" args={["#0d1117"]} />
      <fog attach="fog" args={["#0d1117", 12, 28]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 8, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight
        position={[0, plateY - 0.4, 0]}
        intensity={3 * intensity}
        color="#ff6a20"
        distance={6}
      />

      <Environment preset="warehouse" />

      <group>
        <group position={[0, 0, 0]}>
            <Liquid
              width={W} height={H} depth={D}
              color={LIQUID_MATERIALS[params.liquid].color}
              profileRef={profileRef}
              ambientTemp={params.initialTemp}
              sourceTemp={params.sourceTemp}
            />
            <Container
              width={W} height={H} depth={D}
              color={CONTAINER_MATERIALS[params.containerMaterial].color} showHeat={params.showContainerHeat}
              containerProfileRef={containerProfileRef}
              ambientTemp={params.initialTemp}
              sourceTemp={params.sourceTemp}
            />
        </group>

        <HeatSource width={W} depth={D} y={plateY} intensity={intensity} size={HEAT_SOURCE_SIZES[params.heatSourceSize].scale} />

        <ContactShadows
          position={[0, plateY - 0.09, 0]}
          opacity={0.55}
          scale={14}
          blur={2.4}
          far={6}
        />
        <Grid
          position={[0, plateY - 0.1, 0]}
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#26303d"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#3a4a60"
          fadeDistance={18}
          fadeStrength={1.2}
          infiniteGrid
        />
      </group>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}