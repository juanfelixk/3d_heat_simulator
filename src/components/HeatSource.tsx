import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  width: number;
  depth: number;
  y: number;
  intensity?: number;
  size?: number;
}

export function HeatSource({ width, depth, y, intensity = 1.0, size = 1.0 }: Props) {
  const matRef  = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.85 + Math.sin(t * 2.4) * 0.15;

    if (matRef.current) {
      matRef.current.emissiveIntensity = 2.2 * pulse * intensity;
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(t * 2.4) * 0.04;
      glowRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={[0, y, 0]}>
      {/* Heating plate */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[width * 1.1 * size, 0.08, depth * 1.15 * size]} />
        <meshStandardMaterial
          ref={matRef}
          color="#1a0a08"
          emissive="#ff5a1a"
          emissiveIntensity={2}
          roughness={0.4}
          metalness={0.7}
        />
      </mesh>

      {/* Inner glow ring */}
      <mesh ref={glowRef} position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.max(width, depth) * 1.4, 64]} />
        <meshBasicMaterial
          color="#ff6a20"
          transparent
          opacity={0.35 * intensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Outer soft glow */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.max(width, depth) * 2.2, 64]} />
        <meshBasicMaterial
          color="#ff3a10"
          transparent
          opacity={0.12 * intensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}