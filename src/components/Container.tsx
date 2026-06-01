import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ContainerProfile } from "@/lib/useSolver";

const CW = 32;

const wallHeatVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const wallHeatFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uHeatTex;
  uniform float uTempMin;
  uniform float uTempMax;

  vec3 heatColor(float t) {
    vec3 cool = vec3(0.0, 0.0, 0.0);
    vec3 warm = vec3(1.0, 0.55, 0.05);
    vec3 hot  = vec3(1.0, 0.08, 0.0);
    if (t < 0.5) return mix(cool, warm, t * 2.0);
    return mix(warm, hot, (t - 0.5) * 2.0);
  }

  void main() {
    float temp  = texture2D(uHeatTex, vUv).r;
    float tNorm = clamp((temp - uTempMin) / max(uTempMax - uTempMin, 1.0), 0.0, 1.0);
    vec3  heat  = heatColor(tNorm) * pow(tNorm, 0.7) * 0.9;
    float alpha = tNorm * 0.28;
    gl_FragColor = vec4(heat, alpha);
  }
`;

interface WallHeatProps {
  args: [number, number, number] | [number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  profileRef: React.MutableRefObject<ContainerProfile>;
  face: keyof ContainerProfile;
  ambientTemp: number;
  sourceTemp: number;
}


function WallHeat({ args, position, rotation, profileRef, face, ambientTemp, sourceTemp }: WallHeatProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const tex = useMemo(() => {
    const data = new Float32Array(CW * CW);
    const t = new THREE.DataTexture(data, CW, CW, THREE.RedFormat, THREE.FloatType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, []);

  const uniforms = useMemo(() => ({
    uHeatTex: { value: tex },
    uTempMin: { value: ambientTemp },
    uTempMax: { value: sourceTemp },
  }), []);

  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    const profile = profileRef.current[face];
    if (profile && profile.length === CW * CW) {
      (tex.image.data as Float32Array).set(profile);
      tex.needsUpdate = true;
    }
    mat.uniforms.uTempMin.value = ambientTemp;
    mat.uniforms.uTempMax.value = Math.max(sourceTemp, ambientTemp + 1);
  });

  const isPlane = args.length === 2;

  return (
    <mesh position={position} rotation={rotation} renderOrder={4}>
      {isPlane
        ? <planeGeometry args={args as [number, number]} />
        : <boxGeometry args={args as [number, number, number]} />
      }
      <shaderMaterial
        ref={matRef}
        vertexShader={wallHeatVert}
        fragmentShader={wallHeatFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

interface Props {
  width: number;
  height: number;
  depth: number;
  thickness?: number;
  color?: string;
  showHeat?: boolean;
  containerProfileRef?: React.MutableRefObject<ContainerProfile>;
  ambientTemp?: number;
  sourceTemp?: number;
}

export function Container({ width, height, depth,thickness = 0.06,color = "#b0bec5",showHeat = false,containerProfileRef,ambientTemp = 25, sourceTemp = 180 }: Props) {
  const glassMat = () => (
    <meshPhysicalMaterial
      color={color} transmission={0.7} thickness={0.3}
      roughness={0.05} ior={1.45} clearcoat={1}
      transparent opacity={1} depthWrite={false}
    />
  );

  const hp = { ambientTemp, sourceTemp };

  return (
    <group>
      <mesh position={[0, 0, depth / 2 + thickness / 2]} renderOrder={3}>
        <boxGeometry args={[width + thickness * 2, height, thickness]} />
        {glassMat()}
      </mesh>
      {showHeat && containerProfileRef && (
        <WallHeat args={[width + thickness * 2, height, thickness]} position={[0, 0, depth / 2 + thickness / 2]} profileRef={containerProfileRef} face="front" {...hp} />
      )}

      <mesh position={[0, 0, -depth / 2 - thickness / 2]} renderOrder={3}>
        <boxGeometry args={[width + thickness * 2, height, thickness]} />
        {glassMat()}
      </mesh>
      {showHeat && containerProfileRef && (
        <WallHeat args={[width + thickness * 2, height, thickness]} position={[0, 0, -depth / 2 - thickness / 2]} profileRef={containerProfileRef} face="back" {...hp} />
      )}

      <mesh position={[-width / 2 - thickness / 2, 0, 0]} renderOrder={3}>
        <boxGeometry args={[thickness, height, depth]} />
        {glassMat()}
      </mesh>
      {showHeat && containerProfileRef && (
        <WallHeat args={[thickness, height, depth]} position={[-width / 2 - thickness / 2, 0, 0]} profileRef={containerProfileRef} face="left" {...hp} />
      )}

      <mesh position={[width / 2 + thickness / 2, 0, 0]} renderOrder={3}>
        <boxGeometry args={[thickness, height, depth]} />
        {glassMat()}
      </mesh>
      {showHeat && containerProfileRef && (
        <WallHeat args={[thickness, height, depth]} position={[width / 2 + thickness / 2, 0, 0]} profileRef={containerProfileRef} face="right" {...hp} />
      )}

      <mesh position={[0, -height / 2 - thickness / 2, 0]} renderOrder={3}>
        <boxGeometry args={[width + thickness * 2, thickness, depth + thickness * 2]} />
        {glassMat()}
      </mesh>
      {showHeat && containerProfileRef && (
        <WallHeat args={[width + thickness * 2, depth + thickness * 2]} position={[0, -height / 2 - thickness / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} profileRef={containerProfileRef} face="floor" {...hp} />
      )}
    </group>
  );
}