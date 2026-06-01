import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from dataclasses import dataclass

@dataclass
class ContainerMaterial:
    label: str; thermalConductivity: float; density: float; specificHeat: float; color: str

@dataclass
class LiquidMaterial:
    label: str; thermalDiffusivity: float; density: float; specificHeat: float; boilingPoint: float; color: str

@dataclass
class AirCondition:
    label: str; h: float

CONTAINERS = {
    "stainless_steel": ContainerMaterial("Stainless Steel", 16, 8000, 500,"#78909c"),
    "steel": ContainerMaterial("Steel", 50,  7850, 490, "#546e7a"),
    "copper": ContainerMaterial("Copper", 385, 8960, 385, "#c0602a"),
    "aluminum": ContainerMaterial("Aluminium", 205, 2700, 900, "#e8a020"),
    "cast_iron": ContainerMaterial("Cast Iron", 52, 7200, 460, "#37474f"),
    "glass": ContainerMaterial("Borosilicate Glass", 1.2, 2230, 830, "#5b8fa8"),
}

LIQUIDS = {
    "water": LiquidMaterial("Water", 0.143, 998, 4182, 100, "#1a7abf"),
    "oil": LiquidMaterial("Vegetable Oil", 0.087, 910, 1670, 230, "#3a9c4e"),
    "ethanol": LiquidMaterial("Ethanol", 0.096, 789, 2440, 78.4, "#8e44ad"),
    "glycerol": LiquidMaterial("Glycerol", 0.095, 1261, 2380, 290, "#0097a7"),
    "mercury": LiquidMaterial("Mercury", 4.4, 13534, 140, 357, "#607d8b"),
    "saltwater": LiquidMaterial("Saltwater (3.5%)", 0.138, 1025, 3993, 100.6, "#0277bd"),
}

AIR = {
    "still": AirCondition("Still Air", 5),
    "light_breeze": AirCondition("Light Breeze", 15),
    "fan_low": AirCondition("Fan (Low)", 25),
    "fan_high": AirCondition("Fan (High)", 50),
    "strong_wind": AirCondition("Strong Wind", 100),
}

NX, NY, NZ = 20, 20, 20
L_PHYS = 0.20
DX = L_PHYS / NX
WALL_THICKNESS = 0.003
DT_BASE = 7.0
HEAT_SOURCE_SCALE = 0.8

def run_simulation(container, liquid, air, source_temp=300.0, ambient_temp=25.0, initial_temp=25.0, n_ticks=120, speed=1.0, heat_on=True):

    T_liq = np.full((NY, NX, NZ), initial_temp, dtype=np.float64)
    T_floor= np.full((NX, NZ), initial_temp, dtype=np.float64)
    T_wF = np.full((NY, NX), initial_temp, dtype=np.float64)
    T_wBk = np.full((NY, NX), initial_temp, dtype=np.float64)
    T_wL = np.full((NY, NZ), initial_temp, dtype=np.float64)
    T_wR = np.full((NY, NZ), initial_temp, dtype=np.float64)

    alpha_SI = liquid.thermalDiffusivity * 1e-6
    k_liq = alpha_SI * liquid.density * liquid.specificHeat
    k_cont = container.thermalConductivity
    k_iface = 2 * k_cont * k_liq / (k_cont + k_liq)
    C_floor = container.density * container.specificHeat * WALL_THICKNESS
    C_wall = C_floor
    alpha_floor = k_cont / (container.density * container.specificHeat)
    alpha_floor_norm= alpha_floor / (DX * DX)

    src_half = HEAT_SOURCE_SCALE / 2
    xs = (np.arange(NX) + 0.5) / NX - 0.5
    zs = (np.arange(NZ) + 0.5) / NZ - 0.5
    XX, ZZ = np.meshgrid(xs, zs, indexing='ij')
    in_source = ((np.abs(XX) <= src_half) & (np.abs(ZZ) <= src_half)) if heat_on \
                else np.zeros((NX, NZ), bool)

    nu = 20.0
    alpha_base = alpha_SI / (DX * DX)
    alpha_up = alpha_SI * nu / (DX * DX)
    alpha_h = alpha_SI / (DX * DX)

    dt = DT_BASE * speed
    dt_limit = 0.45 * C_floor / (k_cont / WALL_THICKNESS + k_iface / DX)
    SUBSTEPS = max(20, int(np.ceil(dt / dt_limit)))
    dt_sub = dt / SUBSTEPS

    times, avg_temps = [], []
    boiled_at = None
    elapsed = 0.0

    for _ in range(n_ticks):
        for __ in range(SUBSTEPS):
            dt_f = min(dt_sub, 0.25 / (4 * alpha_floor_norm + 1e-30))
            T_f_pad = np.pad(T_floor, 1, mode='edge')
            lap_fl = alpha_floor_norm * (T_f_pad[2:, 1:-1] + T_f_pad[:-2, 1:-1] + T_f_pad[1:-1, 2:] + T_f_pad[1:-1, :-2] - 4 * T_floor)
            q_src = np.where(in_source, (k_cont / WALL_THICKNESS) * (source_temp - T_floor), 0.0)
            q_fl2liq = (k_iface / DX) * (T_floor - T_liq[0])
            T_floor = T_floor + dt_f * lap_fl + dt_sub * (q_src - q_fl2liq) / C_floor

            dt_l = min(dt_sub, 0.25 / (4 * alpha_h + 2 * alpha_up + 1e-30))
            Tx = np.pad(T_liq, ((0,0),(1,1),(0,0)), mode='edge')
            Tz = np.pad(T_liq, ((0,0),(0,0),(1,1)), mode='edge')
            lap_h = alpha_h * (Tx[:,2:,:] + Tx[:,:-2,:] - 2*T_liq) + \
                    alpha_h * (Tz[:,:,2:] + Tz[:,:,:-2] - 2*T_liq)
            Ty_below = np.empty_like(T_liq); Ty_below[1:] = T_liq[:-1]; Ty_below[0] = T_floor
            Ty_above = np.empty_like(T_liq); Ty_above[:-1] = T_liq[1:];  Ty_above[-1] = T_liq[-1]
            flux_dn = alpha_base * (Ty_above - T_liq)
            flux_up_field = np.where(Ty_below > T_liq, alpha_up, alpha_base) * (Ty_below - T_liq)
            T_new = T_liq + dt_l * (lap_h + flux_up_field + flux_dn)

            T_new[-1] += dt_l * air.h * (ambient_temp - T_new[-1]) / (liquid.density * liquid.specificHeat * DX)
            T_new[0] += dt_sub * (k_iface / DX) * (T_floor - T_new[0]) / (liquid.density * liquid.specificHeat * DX)
            T_liq = T_new

            wall_pairs = [
                (T_wF, T_liq[:, :, -1], (slice(None), slice(None), -1)),
                (T_wBk, T_liq[:, :, 0], (slice(None), slice(None), 0)),
                (T_wL, T_liq[:, 0, :], (slice(None), 0, slice(None))),
                (T_wR, T_liq[:, -1, :], (slice(None), -1, slice(None))),
            ]
            for T_w, adj, idx in wall_pairs:
                q_liq_w = (k_iface / DX) * (adj - T_w)
                q_air_w = air.h * (T_w - ambient_temp)
                T_w += dt_sub * (q_liq_w - q_air_w) / C_wall
                T_liq[idx] -= dt_sub * q_liq_w / (liquid.density * liquid.specificHeat * DX)

        elapsed += dt
        times.append(elapsed)
        avg_temps.append(float(T_liq.mean()))
        if boiled_at is None and T_liq[0].max() >= liquid.boilingPoint:
            boiled_at = elapsed

    return {"times": np.array(times), "avg_temps": np.array(avg_temps),
            "boiling_pt": liquid.boilingPoint, "boiled_at": boiled_at}

N_TICKS = 140
DEFAULT_CONTAINER = CONTAINERS["stainless_steel"]
DEFAULT_LIQUID = LIQUIDS["water"]
DEFAULT_AIR = AIR["still"]

print("Running Graph 1: Liquid materials...")
liq_results = {k: run_simulation(DEFAULT_CONTAINER, v, DEFAULT_AIR, n_ticks=N_TICKS)
               for k, v in LIQUIDS.items()}

print("Running Graph 2: Container materials...")
cont_results = {k: run_simulation(v, DEFAULT_LIQUID, DEFAULT_AIR, n_ticks=N_TICKS)
                for k, v in CONTAINERS.items()}

print("Running Graph 3: Air conditions (cooling scenario)...")
COOL_CONTAINER = CONTAINERS["copper"]
COOL_LIQUID    = LIQUIDS["mercury"]
COOL_INIT_TEMP = 200.0
air_results = {k: run_simulation(COOL_CONTAINER, COOL_LIQUID, v,
                                 source_temp=25.0, ambient_temp=25.0,
                                 initial_temp=COOL_INIT_TEMP, n_ticks=N_TICKS,
                                 heat_on=False)
               for k, v in AIR.items()}

print("Running Graph 4: Edge cases...")
best  = run_simulation(CONTAINERS["copper"], LIQUIDS["mercury"],  AIR["still"],       n_ticks=N_TICKS)
worst = run_simulation(CONTAINERS["glass"],  LIQUIDS["glycerol"], AIR["strong_wind"], n_ticks=N_TICKS)

BG        = "#f4f6f9"
PANEL_BG  = "#ffffff"
GRID_COL  = "#dde2ea"
TEXT_COL  = "#1a1f2e"
MUTED_COL = "#5a6275"

def styled_ax(ax, title, xlabel="Time (s)", ylabel="Avg Liquid Temp (°C)"):
    ax.set_facecolor(PANEL_BG)
    ax.set_title(title, color=TEXT_COL, fontsize=10.5, fontweight='bold', pad=10)
    ax.set_xlabel(xlabel, color=MUTED_COL, fontsize=8)
    ax.set_ylabel(ylabel, color=MUTED_COL, fontsize=8)
    ax.tick_params(colors=MUTED_COL, labelsize=7)
    for spine in ax.spines.values():
        spine.set_edgecolor(GRID_COL)
    ax.grid(True, color=GRID_COL, linewidth=0.7)

def tight_ylim(ax, pad=0.06):
    ymin, ymax = np.inf, -np.inf
    for line in ax.get_lines():
        yd = np.asarray(line.get_ydata(), dtype=float)
        yd = yd[np.isfinite(yd)]
        if len(yd):
            ymin = min(ymin, yd.min())
            ymax = max(ymax, yd.max())
    if np.isfinite(ymin) and np.isfinite(ymax):
        span = max(ymax - ymin, 1.0)
        ax.set_ylim(ymin - pad * span, ymax + pad * span)

def legend(ax, loc='upper left'):
    ax.legend(fontsize=7, facecolor=PANEL_BG, edgecolor=GRID_COL, labelcolor=TEXT_COL, loc=loc, framealpha=0.9)

print("Rendering figure...")
plt.rcParams.update({"font.family": "monospace", "text.color": TEXT_COL})

fig = plt.figure(figsize=(20, 14), facecolor=BG)
fig.suptitle("HEAT DIFFUSION SIMULATION — PARAMETER SENSITIVITY ANALYSIS", color=TEXT_COL, fontsize=14, fontweight='bold', y=0.97)

gs = gridspec.GridSpec(2, 2, figure=fig, hspace=0.42, wspace=0.30, left=0.06, right=0.97, top=0.93, bottom=0.08)

ax1 = fig.add_subplot(gs[0, 0])
styled_ax(ax1, "[1] Liquid Material  (Stainless Steel / Still Air / Heating)")
for key, liq in LIQUIDS.items():
    r = liq_results[key]
    ax1.plot(r["times"], r["avg_temps"], label=liq.label, color=liq.color, linewidth=2)
tight_ylim(ax1)
legend(ax1)

ax2 = fig.add_subplot(gs[0, 1])
styled_ax(ax2, "[2] Container Material  (Water / Still Air / Heating)")
for key, cont in CONTAINERS.items():
    r = cont_results[key]
    ax2.plot(r["times"], r["avg_temps"], label=cont.label, color=cont.color, linewidth=2)
tight_ylim(ax2)
legend(ax2)

ax3 = fig.add_subplot(gs[1, 0])
styled_ax(ax3, "[3] Air Condition  (Copper / Mercury / Cooling from 200°C)")
AIR_COLORS = {
    "still": "#c0392b",
    "light_breeze": "#e67e22",
    "fan_low": "#d4ac0d",
    "fan_high": "#27ae60",
    "strong_wind": "#2980b9",
}
for key, a in AIR.items():
    r = air_results[key]
    ax3.plot(r["times"], r["avg_temps"], label=a.label, color=AIR_COLORS[key], linewidth=2)
tight_ylim(ax3)
legend(ax3, loc='upper right')
ax3.annotate("Higher airflow → faster cooling", xy=(0.98, 0.08), xycoords='axes fraction', ha='right', fontsize=7, color=MUTED_COL, fontstyle='italic')

ax4 = fig.add_subplot(gs[1, 1])
styled_ax(ax4, "[4] Edge Cases — Best vs Worst Combo  (Heating)")
BEST_C, WORST_C = "#c0392b", "#2471a3"
ax4.plot(best["times"],  best["avg_temps"],  color=BEST_C,  linewidth=2.5, label="BEST: Copper + Mercury + Still Air")
ax4.plot(worst["times"], worst["avg_temps"], color=WORST_C, linewidth=2.5, label="WORST: Glass + Glycerol + Strong Wind")
if best["boiled_at"]:
    ax4.axvline(best["boiled_at"], color=BEST_C, linewidth=0.8, linestyle=':', alpha=0.6)
    ax4.text(best["boiled_at"] + 2, (best["avg_temps"].min() + best["avg_temps"].max()) * 0.45, f"Mercury boils\n@ {best['boiled_at']:.0f}s", color=BEST_C, fontsize=6.5, va='bottom')
tight_ylim(ax4)
legend(ax4)

fig.text(0.5, 0.013,
         "[1][2][4] Heating: source=300°C, ambient=25°C, heat source 40%   "
         "[3] Cooling: starts 200°C, no heat, ambient=25°C   "
         "20×20×20 cm pot, DX=1 cm (physical), DT=7 s/tick, nu=20 convection boost",
         ha='center', fontsize=7.5, color=MUTED_COL, fontstyle='italic')

out = "./stats/heat_simulation_final.png"
plt.savefig(out, dpi=160, bbox_inches='tight', facecolor=BG)
plt.close()
print(f"Saved -> {out}")