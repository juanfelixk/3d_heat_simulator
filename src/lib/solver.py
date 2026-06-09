from __future__ import annotations
import json
import math
import sys
from dataclasses import dataclass
from typing import Optional
import numpy as np

NX: int = 20
NY: int = 20
NZ: int = 20
DX: float = 1.0 / NX
DT_BASE: float = 7.0
WALL_THICKNESS: float = 0.003

@dataclass
class ContainerMaterial:
    thermalConductivity: float
    density: float
    specificHeat: float

@dataclass
class LiquidMaterial:
    thermalDiffusivity: float
    density: float
    specificHeat: float
    boilingPoint: float

@dataclass
class AirCondition:
    h: float

@dataclass
class SolverParams:
    initialTemp: float
    sourceTemp: float
    ambientTemp: float
    heatSourceScale: float
    container: ContainerMaterial
    liquid: LiquidMaterial
    air: AirCondition
    speed: float
    running: bool

def parse_params(d: dict) -> SolverParams:
    def pick(cls, data: dict):
        import dataclasses
        keys = {f.name for f in dataclasses.fields(cls)}
        return cls(**{k: v for k, v in data.items() if k in keys})
    return SolverParams(
        initialTemp=d["initialTemp"],
        sourceTemp=d["sourceTemp"],
        ambientTemp=d["ambientTemp"],
        heatSourceScale=d["heatSourceScale"],
        container=pick(ContainerMaterial, d["container"]),
        liquid=pick(LiquidMaterial, d["liquid"]),
        air=pick(AirCondition, d["air"]),
        speed=d["speed"],
        running=d["running"],
    )

def idx(x: int, y: int, z: int) -> int:
    return y * NX * NZ + x * NZ + z

def idxW(a: int, b: int, stride: int) -> int:
    return a * stride + b

class Solver:
    def __init__(self) -> None:
        self.cfg: Optional[SolverParams] = None
        self.T_liq = np.zeros(NX * NY * NZ, dtype=np.float32)
        self.T_wallFront = np.zeros(NY * NX, dtype=np.float32)
        self.T_wallBack = np.zeros(NY * NX, dtype=np.float32)
        self.T_wallLeft = np.zeros(NY * NZ, dtype=np.float32)
        self.T_wallRight = np.zeros(NY * NZ, dtype=np.float32)
        self.T_floor = np.zeros(NX * NZ, dtype=np.float32)

        self._last_src_half: float = -1.0
        self._in_source: Optional[np.ndarray] = None

    def reset(self, initial_temp: float) -> None:
        self.T_liq.fill(initial_temp)
        self.T_floor.fill(initial_temp)
        self.T_wallFront.fill(initial_temp)
        self.T_wallBack.fill(initial_temp)
        self.T_wallLeft.fill(initial_temp)
        self.T_wallRight.fill(initial_temp)

    def step(self, dt: float) -> None:
        if self.cfg is None:
            return
        cfg = self.cfg
        src_half = cfg.heatSourceScale / 2.0
        source_temp = cfg.sourceTemp
        ambient_temp = cfg.ambientTemp
        container = cfg.container
        liquid = cfg.liquid
        air = cfg.air

        alpha_SI = liquid.thermalDiffusivity * 1e-6
        k_liquid = alpha_SI * liquid.density * liquid.specificHeat
        k_cont = container.thermalConductivity
        k_iface = 2.0 * k_cont * k_liquid / (k_cont + k_liquid) # effective k

        # floor
        C_floor = container.density * container.specificHeat * WALL_THICKNESS
        alpha_floor = k_cont / (container.density * container.specificHeat)
        alpha_floor_norm = alpha_floor / (DX * DX)
        dt_floor = min(dt, 0.25 / (4.0 * alpha_floor_norm))

        F = self.T_floor.reshape(NX, NZ)

        F_xm = np.pad(F, ((1, 0), (0, 0)), mode='edge')[:-1, :]
        F_xp = np.pad(F, ((0, 1), (0, 0)), mode='edge')[1:, :]
        F_zm = np.pad(F, ((0, 0), (1, 0)), mode='edge')[:, :-1]
        F_zp = np.pad(F, ((0, 0), (0, 1)), mode='edge')[:, 1:]
        lap_floor = alpha_floor_norm * (F_xm + F_xp + F_zm + F_zp - 4.0 * F)

        if src_half != self._last_src_half:
            fx = (np.arange(NX) + 0.5) / NX - 0.5
            fz = (np.arange(NZ) + 0.5) / NZ - 0.5
            self._in_source  = (np.abs(fx[:, None]) <= src_half) & (np.abs(fz[None, :]) <= src_half)
            self._last_src_half = src_half

        T_liq_bot = self.T_liq.reshape(NY, NX, NZ)[0]

        q_source = np.where(self._in_source, (k_cont / WALL_THICKNESS) * (source_temp - F), 0.0)

        q_to_liq = (k_iface / DX) * (F - T_liq_bot)

        self.T_floor = (F + dt_floor * lap_floor + dt * (q_source - q_to_liq) / C_floor).ravel().astype(np.float32)

        # liquid
        nu = 20.0
        alpha_base = alpha_SI / (DX * DX)
        alpha_up = alpha_SI * nu / (DX * DX)
        alpha_h = alpha_SI / (DX * DX)
        dt_liq = min(dt, 0.25 / (4.0 * alpha_h + 2.0 * alpha_up))

        T = self.T_liq.reshape(NY, NX, NZ)

        wL = self.T_wallLeft .reshape(NY, NZ)
        wR = self.T_wallRight.reshape(NY, NZ)
        wB = self.T_wallBack .reshape(NY, NX)
        wF = self.T_wallFront.reshape(NY, NX)

        T_xm = np.concatenate([wL[:, None, :], T[:, :-1, :]], axis=1)
        T_xp = np.concatenate([T[:, 1:, :], wR[:, None, :]],  axis=1)
        T_zm = np.concatenate([wB[:, :, None], T[:, :, :-1]], axis=2)
        T_zp = np.concatenate([T[:, :, 1:], wF[:, :, None]], axis=2)
        T_ym = np.concatenate([self.T_floor.reshape(NX, NZ)[None], T[:-1]], axis=0)
        T_yp = np.concatenate([T[1:], T[-1:]], axis=0)

        lap_h = alpha_h * (T_xm + T_xp - 2.0 * T) + alpha_h * (T_zm + T_zp - 2.0 * T)
        alpha_vert = np.where(T_ym > T, alpha_up, alpha_base)
        lap_v = alpha_vert * (T_ym - T) + alpha_vert * (T_yp - T)

        q_surf = np.zeros_like(T)
        q_surf[-1] = -(air.h * (T[-1] - ambient_temp)) / (liquid.density * liquid.specificHeat * DX)

        self.T_liq = (T + dt_liq * (lap_h + lap_v + q_surf)).ravel().astype(np.float32)

        # walls
        C_wall = container.density * container.specificHeat * WALL_THICKNESS
        T_up = self.T_liq.reshape(NY, NX, NZ)

        def upd(T_wall_flat, T_adj, shape):
            Tw = T_wall_flat.reshape(shape)
            q_liq = (k_iface / DX) * (T_adj - Tw)
            q_air = air.h * (Tw - ambient_temp)
            return (Tw + dt * (q_liq - q_air) / C_wall).ravel().astype(np.float32)

        self.T_wallFront = upd(self.T_wallFront, T_up[:, :, -1], (NY, NX))
        self.T_wallBack = upd(self.T_wallBack, T_up[:, :, 0], (NY, NX))
        self.T_wallLeft = upd(self.T_wallLeft, T_up[:, 0, :], (NY, NZ))
        self.T_wallRight = upd(self.T_wallRight, T_up[:, -1, :], (NY, NZ))

    def check_boiling(self, boiling_point: float) -> bool:
        return bool(np.max(self.T_liq.reshape(NY, NX, NZ)[0]) >= boiling_point)

    def tick(self, epoch: int, new_cfg: Optional[SolverParams] = None) -> Optional[dict]:
        if new_cfg is not None:
            self.cfg = new_cfg
        if self.cfg is None or not self.cfg.running:
            return None

        cfg = self.cfg
        alpha_SI_tick = cfg.liquid.thermalDiffusivity * 1e-6
        k_liq_tick = alpha_SI_tick * cfg.liquid.density * cfg.liquid.specificHeat
        k_cont_tick = cfg.container.thermalConductivity
        k_iface_tick = 2.0 * k_cont_tick * k_liq_tick / (k_cont_tick + k_liq_tick)
        C_floor_tick = cfg.container.density * cfg.container.specificHeat * WALL_THICKNESS
        dt_limit = 0.45 * C_floor_tick / (k_cont_tick / WALL_THICKNESS + k_iface_tick / DX)

        dt = DT_BASE * cfg.speed
        substeps = max(20, math.ceil(dt / dt_limit))
        for _ in range(substeps):
            self.step(dt / substeps)

        is_boiling = self.check_boiling(cfg.liquid.boilingPoint)

        TX, TY, TZ = 32, 32, 32
        gx = (np.arange(TX) * NX / TX).astype(int)
        gy = (np.arange(TY) * NY / TY).astype(int)
        gz = (np.arange(TZ) * NZ / TZ).astype(int)

        T_3d = self.T_liq.reshape(NY, NX, NZ)
        vol = T_3d[np.ix_(gy, gx, gz)].transpose(0, 2, 1).ravel().astype(np.float32)

        CW = 32
        cy = (np.arange(CW) * NY / CW).astype(int)
        cx = (np.arange(CW) * NX / CW).astype(int)
        cz = (np.arange(CW) * NZ / CW).astype(int)

        w_front = self.T_wallFront.reshape(NY, NX)[np.ix_(cy, cx)].ravel().astype(np.float32)
        w_back  = self.T_wallBack .reshape(NY, NX)[np.ix_(cy, cx)].ravel().astype(np.float32)
        w_left  = self.T_wallLeft .reshape(NY, NZ)[np.ix_(cy, cz)].ravel().astype(np.float32)
        w_right = self.T_wallRight.reshape(NY, NZ)[np.ix_(cy, cz)].ravel().astype(np.float32)
        w_floor = self.T_floor.reshape(NX, NZ)[np.ix_(cx, cz)].T.ravel().astype(np.float32)

        return {
            "isBoiling": bool(is_boiling),
            "epoch": epoch,
            "profile": vol.tolist(),
            "wallFront": w_front.tolist(),
            "wallBack": w_back.tolist(),
            "wallLeft": w_left.tolist(),
            "wallRight": w_right.tolist(),
            "wallFloor": w_floor.tolist(),
        }

def main() -> None:
    solver = Solver()
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError as e:
            sys.stdout.write(json.dumps({"error": str(e)}) + "\n")
            sys.stdout.flush()
            continue

        msg_type = msg.get("type")

        if msg_type == "RESET":
            solver.cfg = parse_params(msg["payload"])
            solver.reset(solver.cfg.initialTemp)
            sys.stdout.write(json.dumps({"type": "READY"}) + "\n")

        elif msg_type == "TICK":
            epoch   = msg.get("epoch", 0)
            new_cfg = parse_params(msg["cfg"]) if msg.get("cfg") else None
            result  = solver.tick(epoch, new_cfg)
            if result:
                sys.stdout.write(json.dumps({"type": "STATE", "payload": result}) + "\n")
            else:
                sys.stdout.write(json.dumps({"type": "IDLE"}) + "\n")

        else:
            sys.stdout.write(json.dumps({"error": f"unknown type: {msg_type}"}) + "\n")

        sys.stdout.flush()

if __name__ == "__main__":
    main()