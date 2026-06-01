import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  width: number;
  height: number;
  depth: number;
  color?: string;
  profileRef?: React.MutableRefObject<Float32Array<ArrayBuffer>>;
  ambientTemp?: number;
  sourceTemp?: number;
}

const TX = 32, TY = 32, TZ = 32;

const vertex = /* glsl */ `
  varying vec3 vLocalPos;
  void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec3 vLocalPos;

  uniform float uHeight;
  uniform float uWidth;
  uniform float uDepth;
  uniform vec3  uColorBase;
  uniform sampler2D uHeatTex;
  uniform float uTempMin;
  uniform float uTempMax;
  uniform float uTY;
  uniform float uTX;
  uniform float uTZ;
  uniform vec3  uCameraLocal;

  vec3 heatColor(float t) {
    vec3 cool = vec3(0.0, 0.0, 0.0);
    vec3 warm = vec3(1.0, 0.55, 0.05);
    vec3 hot  = vec3(1.0, 0.08, 0.0);
    if (t < 0.5) return mix(cool, warm, t * 2.0);
    return mix(warm, hot, (t - 0.5) * 2.0);
  }

  float sampleAtlas(float nx, float nv, float nz) {
    float zScaled = nz * uTZ;
    float lo      = floor(zScaled);
    float hi      = min(lo + 1.0, uTZ - 1.0);
    float frac    = zScaled - lo;
    float s0 = texture2D(uHeatTex, vec2((lo + nx) / uTZ, nv)).r;
    float s1 = texture2D(uHeatTex, vec2((hi + nx) / uTZ, nv)).r;
    return mix(s0, s1, frac);
  }

  void main() {
    vec3 bHalf = vec3(uWidth, uHeight, uDepth) * 0.5;
    vec3 ro    = uCameraLocal;
    vec3 rd    = normalize(vLocalPos - uCameraLocal);

    vec3 tMin = (-bHalf - ro) / rd;
    vec3 tMax = ( bHalf - ro) / rd;
    vec3 t1   = min(tMin, tMax);
    vec3 t2   = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar  = min(min(t2.x, t2.y), t2.z);

    if (tNear >= tFar) { discard; return; }
    tNear = max(tNear, 0.0);

    // ── Ray-march through volume ──────────────────────────────
    const int STEPS = 48;
    float stepSize = (tFar - tNear) / float(STEPS);

    vec4 accum = vec4(0.0);

    for (int i = 0; i < STEPS; i++) {
      float t = tNear + (float(i) + 0.5) * stepSize;
      vec3  p = ro + rd * t;

      float nx = clamp(p.x / uWidth  + 0.5, 0.0, 1.0);
      float ny = clamp(p.y / uHeight + 0.5, 0.0, 1.0);
      float nz = clamp(p.z / uDepth  + 0.5, 0.0, 1.0);
      float nv = (ny * uTY + 0.5) / uTY;

      float temp  = sampleAtlas(nx, nv, nz);
      float tNorm = clamp((temp - uTempMin) / max(uTempMax - uTempMin, 1.0), 0.0, 1.0);

      vec3 baseCol = uColorBase * (0.5 + 0.5 * ny);
      vec3 heat    = heatColor(tNorm) * pow(tNorm, 0.6) * 1.8;

      float alpha  = 0.02 + tNorm * 0.18;

      vec4 src = vec4(baseCol + heat, alpha);
      accum.rgb += (1.0 - accum.a) * src.a * src.rgb;
      accum.a   += (1.0 - accum.a) * src.a;

      if (accum.a > 0.98) break;
    }

    gl_FragColor = accum;
  }
`;

export function Liquid({ width, height, depth, color = "#4fc3f7", profileRef, ambientTemp = 25, sourceTemp = 180 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  const heatTexture = useMemo(() => {
    const data = new Float32Array(TX * TZ * TY);
    data.fill(ambientTemp);
    const tex = new THREE.DataTexture(data, TX * TZ, TY, THREE.RedFormat, THREE.FloatType);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const liqH = height * 0.72;
  const liqW = width * 0.985;
  const liqD = depth  * 0.985;

  const uniforms = useMemo(() => ({
    uHeight: { value: liqH },
    uWidth: { value: liqW },
    uDepth: { value: liqD },
    uColorBase: { value: new THREE.Color(color) },
    uHeatTex: { value: heatTexture },
    uTempMin: { value: ambientTemp },
    uTempMax: { value: sourceTemp },
    uTY: { value: TY },
    uTX: { value: TX },
    uTZ: { value: TZ },
    uCameraLocal: { value: new THREE.Vector3() },
  }), []);

  useFrame(() => {
    const mat  = matRef.current;
    const mesh = meshRef.current;
    if (!mat || !mesh) return;

    tempVec.copy(camera.position);
    mesh.worldToLocal(tempVec);
    mat.uniforms.uCameraLocal.value.copy(tempVec);

    mat.uniforms.uTempMin.value = ambientTemp;
    mat.uniforms.uTempMax.value = Math.max(sourceTemp, ambientTemp + 1);
    mat.uniforms.uColorBase.value.set(color);

    const profile = profileRef?.current;
    if (profile && profile.length === TX * TY * TZ) {
      const atlasDat = heatTexture.image.data as Float32Array;
      atlasDat.set(profile);
      heatTexture.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -height * 0.12, 0]}>
      <mesh ref={meshRef} renderOrder={2}>
        <boxGeometry args={[liqW, liqH, liqD]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}