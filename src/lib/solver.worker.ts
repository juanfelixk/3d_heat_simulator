import type { ContainerMaterial, LiquidMaterial, AirCondition } from "./materials";

const NX = 20;
const NY = 20;
const NZ = 20;
const DX = 1.0 / NX;
const DT_BASE = 7.0;

const WALL_THICKNESS = 0.003; // 3 mm

let T_liq = new Float32Array(NX * NY * NZ) as Float32Array<ArrayBuffer>;
let T_wallFront = new Float32Array(NY * NX) as Float32Array<ArrayBuffer>;
let T_wallBack = new Float32Array(NY * NX) as Float32Array<ArrayBuffer>;
let T_wallLeft = new Float32Array(NY * NZ) as Float32Array<ArrayBuffer>;
let T_wallRight = new Float32Array(NY * NZ) as Float32Array<ArrayBuffer>;
let T_floor = new Float32Array(NX * NZ) as Float32Array<ArrayBuffer>;

let T_liq_new = new Float32Array(NX * NY * NZ) as Float32Array<ArrayBuffer>;
let T_floor_new = new Float32Array(NX * NZ) as Float32Array<ArrayBuffer>;
let T_wallFront_new = new Float32Array(NY * NX) as Float32Array<ArrayBuffer>;
let T_wallBack_new = new Float32Array(NY * NX) as Float32Array<ArrayBuffer>;
let T_wallLeft_new = new Float32Array(NY * NZ) as Float32Array<ArrayBuffer>;
let T_wallRight_new = new Float32Array(NY * NZ) as Float32Array<ArrayBuffer>;

interface SolverParams {
  initialTemp: number;
  sourceTemp: number;
  ambientTemp: number;
  heatSourceScale: number;
  container: ContainerMaterial;
  liquid: LiquidMaterial;
  air: AirCondition;
  speed: number;
  running: boolean;
}

let cfg: SolverParams | null = null;

function idx(x: number, y: number, z: number) {
  return y * NX * NZ + x * NZ + z;
}
function idxW(a: number, b: number, stride: number) {
  return a * stride + b;
}

function reset(initialTemp: number) {
  T_liq.fill(initialTemp);
  T_floor.fill(initialTemp);
  T_wallFront.fill(initialTemp);
  T_wallBack.fill(initialTemp);
  T_wallLeft.fill(initialTemp);
  T_wallRight.fill(initialTemp);
}

function step(dt: number) {
    if (!cfg) return;
    const { sourceTemp, ambientTemp, heatSourceScale, container, liquid, air } = cfg;
    const srcHalf = heatSourceScale / 2;
    const alpha_SI = liquid.thermalDiffusivity * 1e-6; // mm²/s --> m²/s
    const k_liquid = alpha_SI * liquid.density * liquid.specificHeat;
    const k_cont = container.thermalConductivity;
    const k_iface = 2 * k_cont * k_liquid / (k_cont + k_liquid); // harmonic mean

    T_floor_new.set(T_floor);
    const C_floor = container.density * container.specificHeat * WALL_THICKNESS;
    const alpha_floor = k_cont / (container.density * container.specificHeat);
    const alpha_floor_norm = alpha_floor / (DX * DX);
    const dt_floor = Math.min(dt, 0.25 / (4 * alpha_floor_norm));

    for (let xi = 0; xi < NX; xi++) {
        for (let zi = 0; zi < NZ; zi++) {
          const fx = (xi + 0.5) / NX - 0.5;
          const fz = (zi + 0.5) / NZ - 0.5;
          const inSource = Math.abs(fx) <= srcHalf && Math.abs(fz) <= srcHalf;

          const T_f = T_floor[idxW(xi, zi, NZ)];
          const T_liqBot = T_liq[idx(xi, 0, zi)];

          const T_xm = xi > 0 ? T_floor[idxW(xi-1, zi, NZ)] : T_f;
          const T_xp = xi < NX-1 ? T_floor[idxW(xi+1, zi, NZ)] : T_f;
          const T_zm = zi > 0 ? T_floor[idxW(xi, zi-1, NZ)] : T_f;
          const T_zp = zi < NZ-1 ? T_floor[idxW(xi, zi+1, NZ)] : T_f;
          const lap_floor = alpha_floor_norm * (T_xm + T_xp + T_zm + T_zp - 4 * T_f);

          const q_source = inSource ? (k_cont / WALL_THICKNESS) * (sourceTemp - T_f) : 0;

          const q_to_liq = (k_iface / DX) * (T_f - T_liqBot);

          T_floor_new[idxW(xi, zi, NZ)] = T_f + dt_floor * lap_floor + dt * (q_source - q_to_liq) / C_floor;
        }
    }
    T_floor = T_floor_new;

  const nu = 20.0;
  const alpha_base = alpha_SI / (DX * DX);
  const alpha_up = alpha_SI * nu / (DX * DX);
  const alpha_h = alpha_SI / (DX * DX);

  // Stability check: max dt for explicit scheme
  const dt_stable = 0.25 / (4 * alpha_h + 2 * alpha_up);
  const dt_liq = Math.min(dt, dt_stable);

  T_liq_new.set(T_liq);

  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      for (let z = 0; z < NZ; z++) {
        const T_c = T_liq[idx(x, y, z)];

        const T_xm = x > 0 ? T_liq[idx(x-1, y, z)] : T_wallLeft[idxW(y, z, NZ)];
        const T_xp = x < NX-1 ? T_liq[idx(x+1, y, z)] : T_wallRight[idxW(y, z, NZ)];
        const T_zm = z > 0 ? T_liq[idx(x, y, z-1)] : T_wallBack[idxW(y, x, NX)];
        const T_zp = z < NZ-1 ? T_liq[idx(x, y, z+1)] : T_wallFront[idxW(y, x, NX)];
        const T_ym = y > 0 ? T_liq[idx(x, y-1, z)] : T_floor[idxW(x, z, NZ)];
        const T_yp = y < NY-1 ? T_liq[idx(x, y+1, z)] : T_c;

        // Horizontal conduction (symmetric x and z)
        const lap_h = alpha_h * (T_xm + T_xp - 2*T_c) + alpha_h * (T_zm + T_zp - 2*T_c);

        // Vertical: upward convection boost, normal downward
        const alpha_vert = (T_ym > T_c) ? alpha_up : alpha_base;
        const flux_up    = alpha_vert * (T_ym - T_c);
        const flux_down  = alpha_vert * (T_yp - T_c);

        const lap = lap_h + flux_up + flux_down;

        let q_surf = 0;
        if (y === NY - 1) {
          q_surf = -(air.h * (T_c - ambientTemp)) / (liquid.density * liquid.specificHeat * DX);
        }

        T_liq_new[idx(x, y, z)] = T_c + dt_liq * (lap + q_surf);
      }
    }
  }
  T_liq = T_liq_new;

  const C_wall = container.density * container.specificHeat * WALL_THICKNESS;

    function updateWallInto(target: Float32Array<ArrayBuffer>, T_wall: Float32Array<ArrayBuffer>, getAdjacentLiqTemp: (a: number, b: number) => number, sizeA: number, sizeB: number ): void {
        target.set(T_wall);
        for (let a = 0; a < sizeA; a++) {
            for (let b = 0; b < sizeB; b++) {
              const T_w = T_wall[idxW(a, b, sizeB)];
              const T_adj = getAdjacentLiqTemp(a, b);
              const q_liq = (k_iface / DX) * (T_adj - T_w);
              const q_air = air.h * (T_w - ambientTemp);
              target[idxW(a, b, sizeB)] = T_w + dt * (q_liq - q_air) / C_wall;
            }
        }
    }

    updateWallInto(T_wallFront_new, T_wallFront, (y, x) => T_liq[idx(x, y, NZ-1)], NY, NX);
    updateWallInto(T_wallBack_new, T_wallBack, (y, x) => T_liq[idx(x, y, 0)], NY, NX);
    updateWallInto(T_wallLeft_new, T_wallLeft, (y, z) => T_liq[idx(0,  y, z)], NY, NZ);
    updateWallInto(T_wallRight_new, T_wallRight, (y, z) => T_liq[idx(NX-1, y, z)], NY, NZ);

    T_wallFront = T_wallFront_new;
    T_wallBack = T_wallBack_new;
    T_wallLeft = T_wallLeft_new;
    T_wallRight = T_wallRight_new;
}

function checkBoiling(boilingPoint: number): boolean {
  let maxBot = -Infinity;
  for (let x = 0; x < NX; x++)
    for (let z = 0; z < NZ; z++)
      maxBot = Math.max(maxBot, T_liq[idx(x, 0, z)]);
  return maxBot >= boilingPoint;
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === "CONFIGURE") {
    cfg = payload as SolverParams;
  }

  if (type === "RESET") {
    cfg = payload as SolverParams;
    reset(cfg.initialTemp);
  }

  if (type === "TICK") {
    const epoch = e.data.epoch;
    if (e.data.cfg) cfg = e.data.cfg;
    if (!cfg || !cfg.running) return;
    
    const alpha_SI_tick = cfg.liquid.thermalDiffusivity * 1e-6;
    const k_liq_tick = alpha_SI_tick * cfg.liquid.density * cfg.liquid.specificHeat;
    const k_cont_tick = cfg.container.thermalConductivity;
    const k_iface_tick = 2 * k_cont_tick * k_liq_tick / (k_cont_tick + k_liq_tick);
    const C_floor_tick = cfg.container.density * cfg.container.specificHeat * WALL_THICKNESS;
    const dt_limit = 0.45 * C_floor_tick / (k_cont_tick / WALL_THICKNESS + k_iface_tick / DX);

    const dt = DT_BASE * cfg.speed;
    const SUBSTEPS = Math.max(20, Math.ceil(dt / dt_limit));
    for (let i = 0; i < SUBSTEPS; i++) step(dt / SUBSTEPS);

    const isBoiling = checkBoiling((cfg as any).liquid.boilingPoint);

    const TX = 32, TY = 32, TZ = 32;
    const vol = new Float32Array(TX * TY * TZ);
    for (let ty = 0; ty < TY; ty++) {
      for (let tz = 0; tz < TZ; tz++) {
        for (let tx = 0; tx < TX; tx++) {
          const gx = Math.floor(tx * NX / TX);
          const gy = Math.floor(ty * NY / TY);
          const gz = Math.floor(tz * NZ / TZ);
          vol[ty * TX * TZ + tz * TX + tx] = T_liq[idx(gx, gy, gz)];
        }
      }
    }

    const CW = 32;
    const wFront = new Float32Array(CW * CW);
    const wBack = new Float32Array(CW * CW);
    const wLeft = new Float32Array(CW * CW);
    const wRight = new Float32Array(CW * CW);
    const wFloor = new Float32Array(CW * CW);

    for (let cy = 0; cy < CW; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        const gy = Math.floor(cy * NY / CW);
        const gx = Math.floor(cx * NX / CW);
        wFront[cy * CW + cx] = T_wallFront[idxW(gy, gx, NX)];
        wBack [cy * CW + cx] = T_wallBack [idxW(gy, gx, NX)];
      }
    }
    for (let cy = 0; cy < CW; cy++) {
      for (let cz = 0; cz < CW; cz++) {
        const gy = Math.floor(cy * NY / CW);
        const gz = Math.floor(cz * NZ / CW);
        wLeft [cy * CW + cz] = T_wallLeft [idxW(gy, gz, NZ)];
        wRight[cy * CW + cz] = T_wallRight[idxW(gy, gz, NZ)];
      }
    }
    for (let cz = 0; cz < CW; cz++) {
      for (let cx = 0; cx < CW; cx++) {
        const gx = Math.floor(cx * NX / CW);
        const gz = Math.floor(cz * NZ / CW);
        wFloor[cz * CW + cx] = T_floor[idxW(gx, gz, NZ)];
      }
    }

    self.postMessage(
      { type: "STATE", payload: { profile: vol, isBoiling, epoch, wallFront: wFront, wallBack: wBack, wallLeft: wLeft, wallRight: wRight, wallFloor: wFloor } },
      { transfer: [vol.buffer, wFront.buffer, wBack.buffer, wLeft.buffer, wRight.buffer, wFloor.buffer] }
    );
  }
};