# P0 golden fixtures

Hand-calculated reference results for the incompressible Hydro-Flow solver.

## Fluid and constants

| Quantity | Value |
|---|---|
| Water at 20 °C density ρ | 998.2 kg/m³ |
| Dynamic viscosity μ | 1.002×10⁻³ Pa·s |
| g | 9.80665 m/s² |
| Atmospheric pressure | 101325 Pa |
| Pipe roughness ε | 4.5×10⁻⁵ m |
| Turbulent friction | Swamee–Jain |
| Laminar friction | 64/Re when Re < 2300 |

Pipe pressure drop used for the goldens:

```
Δp = (f L/D + K) · ρ V² / 2
V = Q / (π D² / 4)
Re = ρ V D / μ
```

Boundary `pFixed` values in the example JSON files already include `Patm + ρ g z`. If the solver *also* applies elevation from node `elevation` / `z`, use `pFixed = Patm` instead or you will double-count hydrostatic head.

## Cases

See `goldens.json`.

- **A** `examples/series-pipes.hydroflow.json` — two pipes in series, 15 m static head.
- **B** `examples/pump-loop.hydroflow.json` — pump `H = 30 − 2000 Q²` against the Case-C single-pipe system curve plus 15 m lift.
- **C** `examples/parallel-pipes.hydroflow.json` — two identical pipes; each branch matches a single-pipe 15 m-head solution.
- **D** emitter `Q = k P^x` with x = 0.5 calibrated at 2.0 L/h @ 100 kPa.

P0 acceptance from the research report: computed flow within **1 %** of these Q values.
