import numpy as np
import csv, os

NX, NY, NZ = 20, 20, 20
DX = 1.0 / NX
DT_BASE = 7.0
SPEED = 1.0
WALL_THICKNESS = 0.003
NU = 20.0

ALPHA_MM2S = 0.143
ALPHA_SI = ALPHA_MM2S * 1e-6

ALPHA_EFF = ALPHA_SI / (DX * DX)

ALPHA_H = ALPHA_EFF
dt_stable = 0.25 / (4 * ALPHA_H + 2 * ALPHA_H)
DT = DT_BASE * SPEED
SUBSTEPS = max(20, int(np.ceil(DT / dt_stable)))
DT_SUB = DT / SUBSTEPS

def idx(x, y, z):
    return y * NX * NZ + x * NZ + z

xs = (np.arange(NX) + 0.5) / NX
ys = (np.arange(NY) + 0.5) / NY
zs = (np.arange(NZ) + 0.5) / NZ
X3, Y3, Z3 = np.meshgrid(xs, ys, zs, indexing='ij')

T = np.sin(np.pi * X3) * np.sin(np.pi * Y3) * np.sin(np.pi * Z3)

LAM = 3 * np.pi**2 * ALPHA_EFF

def analytical(t):
    return np.sin(np.pi * X3) * np.sin(np.pi * Y3) * np.sin(np.pi * Z3) * np.exp(-LAM * t)

def substep(T, dt_s):
    Tnew = T.copy()

    Tp = np.pad(T, 1, mode='constant', constant_values=0.0)

    lap_x = Tp[2:, 1:-1, 1:-1] + Tp[:-2, 1:-1, 1:-1] - 2*T
    lap_y = Tp[1:-1, 2:, 1:-1] + Tp[1:-1, :-2, 1:-1] - 2*T
    lap_z = Tp[1:-1, 1:-1, 2:] + Tp[1:-1, 1:-1, :-2] - 2*T

    Tnew = T + dt_s * ALPHA_EFF * (lap_x + lap_y + lap_z)
    return Tnew

TOTAL_TICKS = 600
SAMPLE_EVERY = 40

records = []
elapsed = 0.0

for tick in range(1, TOTAL_TICKS + 1):
    for _ in range(SUBSTEPS):
        T = substep(T, DT_SUB)
    elapsed += DT

    if tick % SAMPLE_EVERY == 0:
        T_ex = analytical(elapsed)
        diff = T - T_ex
        rmse = np.sqrt(np.mean(diff**2))
        maxabs = np.max(np.abs(diff))
        records.append((tick, elapsed, rmse, maxabs))
        print(f"{tick:>6} {elapsed:>9.1f} {rmse:>14.4e} {maxabs:>14.4e}")

os.makedirs("stats", exist_ok=True)
csv_path = "stats/solver_error_analysis.csv"
with open(csv_path, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Step", "Time (s)", "RMSE", "Max Abs Error"])
    w.writerows(records)
print(f"\nCSV saved -> {csv_path}")

def sci_tex(v):
    if not np.isfinite(v) or v == 0:
        return "—"
    exp = int(np.floor(np.log10(abs(v))))
    coeff = v / 10**exp
    return f"{coeff:.2f} \\times 10^{{{exp}}}"

tex_path = "stats/solver_error_table.tex"
with open(tex_path, "w") as f:
    f.write("\\begin{table}[H]\n\\centering\n")
    f.write("\\caption{Explicit FD error analysis: 3D solver.worker.ts vs.~analytical solution. "
        "$N=20^3$, $\\Delta x = 1/20$, "
        f"$\\alpha_{{\\rm eff}}={ALPHA_EFF:.3e}$\\,s$^{{-1}}$, "
        f"$\\Delta t_{{\\rm sub}}={DT_SUB:.3e}$\\,s, SUBSTEPS={SUBSTEPS}.}}\n")
    f.write("\\begin{tabular}{rrrr}\n\\hline\n")
    f.write("Step & Time (s) & RMSE & Max $|$error$|$ \\\\\n\\hline\n")
    for step, t, rmse, maxabs in records:
        f.write(f"{step} & {t:.1f} & ${sci_tex(rmse)}$ & ${sci_tex(maxabs)}$ \\\\\n")
    f.write("\\hline\n\\end{tabular}\n\\end{table}\n")
print(f"LaTeX table saved -> {tex_path}")

import matplotlib.pyplot as plt

steps_arr = np.array([r[0] for r in records])
times_arr = np.array([r[1] for r in records])
rmse_arr = np.array([r[2] for r in records])
max_arr = np.array([r[3] for r in records])

fig, axes = plt.subplots(1, 3, figsize=(14, 4))
fig.suptitle("solver.worker.ts — Explicit FD 3D Error vs Analytical Solution", fontweight="bold")

axes[0].semilogy(times_arr, rmse_arr, "o-", color="#2471a3", linewidth=1.8)
axes[0].set_title("RMSE"); axes[0].set_xlabel("Time (s)"); axes[0].set_ylabel("RMSE")
axes[0].grid(True, alpha=0.3)

axes[1].semilogy(times_arr, max_arr, "o-", color="#c0392b", linewidth=1.8)
axes[1].set_title("Max |Error|"); axes[1].set_xlabel("Time (s)"); axes[1].set_ylabel("Max |error|")
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("stats/solver_error_plot.png", dpi=150, bbox_inches="tight")
plt.close()
print("Plot saved -> stats/solver_error_plot.png")