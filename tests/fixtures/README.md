# P0 golden fixtures

Reference results for the incompressible hydro-flow solver (`src/engine`). Cases A–D in `goldens.json` are hand calculations produced by `scripts/goldens-reference.mjs`, which shares no code with the engine (Swamee–Jain friction, bisection on the head balance). Case E is an engine regression pin. Acceptance is 1% relative on flow.

```bash
node scripts/goldens-reference.mjs          # print the reference values
node scripts/goldens-reference.mjs --write  # regenerate the expected blocks
```

`npm run check` fails when A–D drift from the script. `npm test` (`tests/goldens.test.ts`) fails when the engine drifts from A–E.

## Fluid and constants

| Quantity | Value |
|---|---|
| Water at 20 °C density ρ | 998.2 kg/m³ |
| Dynamic viscosity μ | 1.002×10⁻³ Pa·s |
| g | 9.80665 m/s² |
| Atmospheric pressure | 101325 Pa |
| Pipe roughness ε | 4.5×10⁻⁵ m |
| Friction (reference) | Swamee–Jain for Re ≥ 2300, 64/Re below |
| Friction (engine) | Churchill (1977), all Re; within 0.05% of the reference on these cases |

Pipe pressure drop:

```
Δp_friction = (f L/D + K) · ρ V |V| / 2
P_from − P_to = Δp_friction + ρ g (z_to − z_from) − Δp_pump
```

Boundary `pFixed` is absolute pressure. Reservoirs use Patm. Hydrostatic head is applied from node `z`. Do not bake `ρ g z` into `pFixed` or head is double-counted.

Pump head is a polynomial `H(Q) = c0 + c1 Q + c2 Q²` (m, Q in m³/s), stored as `component.pump.coeffs`.

## Cases

See `goldens.json`.

- **A** `examples/series-pipes.hydroflow.json` — two pipes in series, 15 m static head.
- **B** `examples/pump-loop.hydroflow.json` — pump `H = 30 − 2000 Q²` against one pipe plus 15 m lift.
- **C** `examples/parallel-pipes.hydroflow.json` — two identical pipes; equal split.
- **D** emitter `Q = k P^x` — not implemented; `file` is null.
- **E** `examples/dlc-pumped-cooling.hydroflow.json` — compiled DLC worked example.
