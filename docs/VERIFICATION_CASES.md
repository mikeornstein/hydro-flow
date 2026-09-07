# Verification cases and essential tests

Companion to the research report. This file specifies the **unit, integration, and end-to-end tests that are essential** before Hydro-Flow can claim it cloned MacroFlow’s core FNM behavior. It is not source code.

Related files:

- [MACROFLOW_RESEARCH.md](MACROFLOW_RESEARCH.md) — product and method survey
- [schema/hydroflow.project.schema.json](schema/hydroflow.project.schema.json) — project JSON
- [../tests/fixtures/goldens.json](../tests/fixtures/goldens.json) — P0 numeric targets
- [../tests/fixtures/README.md](../tests/fixtures/README.md) — elevation / fluid conventions

Paper citations use the vendor PDF ids (MF01–MF15) listed in the research report. Numbers below that come from HTML/PDF text extraction should be treated as **targets to re-check against the PDF figures** before they become hard goldens. Analytic P0 goldens already in the repo are the only 1% numeric bar today.

---

## 1. Accuracy policy

| Class | Bar | Source |
|---|---|---|
| Analytic hydraulics (single pipe, series, parallel, hydrostatic) | relative error on `Q` and `Δp` ≤ **1%** | `tests/fixtures/goldens.json` |
| Pump / system-curve intersection with a tabulated or polynomial curve | `Q` ≤ **1%** | Golden B |
| Emitter `Q = k P^x` | `Q` ≤ **1%** | Golden D |
| Continuity at every free node | `|ΣQ|` below solver mass tolerance (1e-8 … 1e-10) | FNM mass law |
| FNM vs 3-D CFD of the *same* layout | historically **~7–12%** on branch flow | MF08 Case B |
| FNM vs hardware / prototype | historically **~10–18%** on system CFM or `Δp` | MF06, MF11, MF14 |
| FNM vs Ellison-style handbook network | not a pass/fail; Ellison was 18% low vs test where MacroFlow matched | MF06 |

Do **not** fail a paper-replay e2e because it missed a scraped CFM by 1%. Paper replays are **trend / inequality / coupling-pattern** tests until someone digitizes the original figures.

Do **not** claim chip-junction temperatures. MacroFlow itself does not predict them (MF01 limitations).

---

## 2. Physics conventions the tests must lock down

### 2.1 Pressure drop (canonical published forms)

Use these, not OCR-garbled variants such as `Δp = K ρ Q² A`.

Darcy + minor loss (P0 goldens):

```text
Δp = (f L/D + K) · ρ V² / 2
V  = Q / (π D² / 4)
Re = ρ |V| D / μ
```

Equivalent handbook form used in MF03 / MF08:

```text
Δp = K ρ (Q/A)² / 2     =     K ρ Q² / (2 A²)
```

Power-law form used in MF13:

```text
Δp = K ρ (Q/A)^n          n ≈ 1 laminar friction, n ≈ 2 turbulent / minor
```

Re-dependent `K` (MF08) — required once electronics/air packs land:

- `Re ≤ Re_lam` — laminar branch (`K` or `f` from 64/Re)
- `Re ≥ Re_turb` — constant `K` or Churchill / Swamee–Jain / Colebrook `f`
- between — interpolate

Friction factor for P0 goldens:

- `Re < 2300` → `f = 64/Re`
This engine ships **Churchill (1977)** for Darcy `f` at all Re (Hagen–Poiseuille recovered in laminar). P0 goldens A–D in `tests/fixtures/goldens.json` are Swamee–Jain hand calculations from `scripts/goldens-reference.mjs`, independent of the engine; Churchill lands within 0.05% of them on these cases. Do not treat U2 below as a requirement to replace Churchill.

- `Re < Re_lam` — Hagen–Poiseuille / `f = 64/Re` (Churchill matches this)
- else Churchill (default) or Swamee–Jain: `f = 0.25 / [log10(ε/D / 3.7 + 5.74 / Re^0.9)]²`

Fluid for current goldens: water 20 °C, `ρ = 998.2 kg/m³`, `μ = 1.002×10⁻³ Pa·s`, `g = 9.80665 m/s²`, `Patm = 101325 Pa`, `ε = 4.5×10⁻⁵ m`.

### 2.2 Elevation — apply once

Example JSON already stores `pFixed = Patm + ρ g z` on reservoirs. A solver that *also* adds `ρ g Δz` from `node.elevation` will double-count and fail Goldens A–C.

Unit test: two encodings of the same 15 m lift must give the same `Q`.

1. `pFixed` includes `ρ g z`, links have `dZ = 0`.
2. `pFixed = Patm` on both ends, links have `dZ = z_to − z_from` (or node elevations enabled).

### 2.3 Mass, momentum, energy

- Link unknown: volumetric `Q` (incompressible P0) or mass `ṁ` later.
- Node unknown: pressure `P` (and `T` when energy is on).
- Continuity at a free node: `Σ ρ Q_l = 0` (incompressible: `Σ Q_l = 0`).
- Momentum residual: `P_from − P_to − Δp_loss + Δp_pump = 0` under the chosen elevation convention.
- Energy (P2): `q = h A (T_s − T_b)`, `Nu = C Re^m Pr^n`, mixing is enthalpy-weighted at nodes, `ΔT = q / (ṁ c_p)` on an adiabatic-wall heated link.

### 2.4 Solver contract

SIMPLE / Newton as published (MF01, MF03, MF13, Patankar 1980):

1. Guess `Q` on links and `P` (and `T`) on nodes.
2. Linearize each `Δp(Q)` (Newton: `R = d(Δp)/dQ`).
3. Form pressure-correction / simultaneous system from momentum + continuity.
4. Direct solve of that small dense/sparse matrix; update `P` and `Q` with optional under-relaxation.
5. If energy is on, solve the discrete energy system.
6. Update properties if they depend on `T` or `P`.
7. Iterate until residuals drop below tolerance or `maxIter`.

Return status must be one of `converged | diverged | max-iter | singular | choked`. The UI must not present unconverged fields as accepted results.

Density is an input, not a constant of nature (MF06 was run at 5000 ft).

---

## 3. Essential unit tests

These are the tests that catch a wrong engine. They do not need a canvas.

### U1. Laminar friction

Pipe `Re < 2300`. Compare `Δp` to `f = 64/Re` Darcy–Weisbach closed form. Tolerance 1e-6 relative (analytic identity if the same `f` is used).

### U2. Turbulent friction (Churchill; Swamee–Jain optional)

Pipe `Re ~ 1e5`, `ε/D` from Golden A (`D = 0.05 m`, `ε = 4.5e-5 m`). Compare `Δp` to an independent Swamee–Jain + Darcy evaluation. Tolerance 0.5% because the engine substitutes Churchill.

### U3. Minor loss only

`L = 0`, `K > 0`. `Δp = K ρ V² / 2`. Sign follows `Q`.

### U4. Hydrostatic only

No friction, no `K`, elevation 15 m of water-20 °C. `Δp = 15 × 998.2 × 9.80665 = 146834.97045 Pa`. Catch double-counted gravity here.

### U5. Series additivity

Two pipes end-to-end, same `Q`. `Δp_total = Δp_1 + Δp_2`. Matches Golden A topology.

Golden A expected (1% bar):

| Link | Q (m³/s) | V (m/s) | Re | f | Δp (Pa) |
|---|---|---|---|---|---|
| pipe-1 L=50 D=0.05 K=0.5 | 3.471278803556e-3 | 1.7679 | 88060 | 0.022278 | 35531.80 |
| pipe-2 L=50 D=0.04 K=1.0 | same Q | 2.7624 | 110075 | 0.022580 | 111303.18 |

Nodes: `res-hi` 297104.9606 Pa, `mid` 261573.16546 Pa, `res-lo` 150269.99015 Pa.

### U6. Parallel split

Two identical pipes, same `Δp`. `Q` each equals the single-pipe solution; total is 2×. Golden C: each `Q = 5.049515832330e-3 m³/s`.

### U7. Pump / system intersection

Pump `H = 30 − 2000 Q²` (m, m³/s) against Golden C pipe + 15 m lift. Golden B: `Q = 5.040585921353e-3 m³/s`, `H ≈ 29.949 m`.

Also unit-test curve interpolation: query `H` at tabulated knots and halfway between knots.

### U8. Emitter

`Q = k P^x` with `x = 0.5`, calibrated 2.0 L/h at 100 kPa → `k = 1.756820922316e-9` (SI). At 150 kPa, `Q = 6.804138174398e-7 m³/s` (2.4495 L/h). Golden D.

### U9. Continuity residual

After any converged solve, every free node satisfies `|ΣQ| < tol`. Series mid-node: inflow equals outflow to machine precision relative to `|Q|`.

### U10. Energy identity (P2)

Single heated pipe, known `ṁ`, known `q`, adiabatic walls except the specified source. `T_out − T_in = q / (ṁ c_p)` within 1e-6 relative. Mixing tee: two incoming streams at different `T`, outlet is mass-weighted.

### U11. Re-dependent K (MF08, P2 air pack)

A screen or perforated plate whose `K` changes across laminar / transition / turbulent. Assert the three branches and a continuous interpolation. No 1% golden until we pick a published `K(Re)` table (Idelchik screen chapter).

### U12. Units round-trip

Store SI. Display IP. Editing a length in inches must write meters. Pressure psi ↔ Pa, gpm ↔ m³/s, °F ↔ K. Round-trip error < 1e-12 relative on the SI value.

### U13. Schema

Accept `examples/*.hydroflow.json`. Reject: missing `from`/`to`, unknown node id, `version` other than `0.1.0`, pipe without `geometry.D`, pump without `pump.coeffs`.

### U14. Solver status

- Well-posed Golden A → `converged`.
- Disconnected free node with no BC → `singular` or a structured warning, not a silent `Q = 0`.
- Impossible closed loop with two conflicting `pFixed` and no resistance → `singular` / `diverged`.
- `maxIter = 1` on a nonlinear pump loop → `max-iter`, fields flagged dirty.

### U15. Density input (MF06)

Same geometry, `ρ` reduced to a 5000 ft air density, `Q` must change. Prevents hard-coding sea-level air or water.

### U16. Sign of flow

Reverse `from`/`to` on a single pipe between two reservoirs. `Q` flips sign (or the solver reports a positive `Q` with swapped ends — pick one convention and test it). Loop `ΣΔp` around a closed cycle is 0.

---

## 4. Essential integration tests (engine, no UI)

### I1. Goldens A, B, C, D

Load the example JSON files and compare to `tests/fixtures/goldens.json` at 1% on `Q` and on `P` where given. This is the P0 acceptance test named in the research report.

### I2. Header maldistribution (MF03 cold plate, qualitative)

Seven identical laterals off a feeder. Total `Q` fixed (5 gpm water in the paper).

- Small header diameter → first laterals take more flow than the last (monotonic decay).
- Header diameter ×2 → range(`Q_i`) shrinks.

Do not hard-code the paper’s un-tabulated branch flows. Assert inequalities.

### I3. Orifice balancing (MF03 loop / MF04 direction)

Three parallel branches with unequal heat loads or unequal `K`. Start with identical orifices → uneven `T` or uneven `Q`. Increase `K` on the greedy branch → that `Q` falls and the starved branch rises. Inverse orifice sizing is a workflow, not a v1 solver mode.

### I4. Bypass vs primary path (MF09)

Two parallel paths: “sink” (higher `K` or longer / rougher) and “bypass” (clearance). Total `Q` fixed (paper used 10 SCFM air).

Assert: as bypass area ↑, fraction through the sink ↓ monotonically. Paper figures are roughly linear in clearance fraction; treat the 100/80/40/0% series as a trend, not a 1% golden.

Geometry if anyone later builds a closer replay: Wakefield plate-fin 2.2 × 4.6 × 0.75 in, pitch 0.1 in, t = 0.012 in, 46 interfin channels, `h = 36.6 W/m²K` laminar (energy phase).

### I5. Fan fail (MF08 / advertised contingency)

`N` identical fans in parallel + a system curve. Disable one fan.

- Total `Q` drops but not by `1/N` (remaining fans move out on their curves).
- No remaining fan exceeds its tabulated stall / max-head point without a warning.

### I6. Composite component (MF11)

Solve a small subnetwork, tabulate `Δp(Q)`, replace the subnetwork with a `curve` component, re-solve the parent. Parent `Q` and `Δp` match the expanded network within 1% over the tabulated range. This is how MacroFlow scaled LCM → row → full manifold.

### I7. Gravity on vs off (MF11 note)

A vertical riser with meaningful `ρ g Δz`. Gravity off vs on changes `Q`. Same test as U4 but through the project flag `analysis.gravity`.

### I8. Multiplicity (MF01 card stacks)

Four identical parallel channels represented as one link with multiplicity 4 vs four explicit links. Same total `Q` and `Δp`.

### I9. What-if snapshot

Clone a solved project, change one `D` or one `K`, re-solve. Both result sets remain available. `Q` moves in the expected direction (larger `D` → larger `Q` for a fixed head).

---

## 5. Essential end-to-end tests (product)

These are the tests that prove the *clone of core functionality*, not just the algebra. They can be Playwright / Cypress later; specify them now so the editor is not built blind.

### E1. Empty-to-solved loop

New project → pick water + SI → drop two boundary nodes and one pipe → set `pFixed` / length / diameter → Solve → canvas shows `Q` and both `P` values → status `converged`.

### E2. Load example

Open `examples/series-pipes.hydroflow.json` → Solve → values match Golden A within 1% → mid-node `P` visible without opening a dialog.

### E3. Save / load bit-identical project

Save JSON, reload, `version` and graph unchanged. A reload + solve reproduces `Q`.

### E4. Compare designs

Duplicate, change pipe `D`, solve both, show two `Q` columns or a delta. This is MacroFlow’s “compare performance of different designs.”

### E5. Export

CSV (or equivalent) contains link id, `Q`, `Δp`, `V`, `Re`. Units follow the current display system. Plot/workspace export can wait; tables cannot — engineers live in the table.

### E6. Residuals are visible

Solve panel shows iteration count and last residual. Unconverged run cannot be exported as a clean result without an explicit override.

### E7. Fan / pump fail what-if

On the pump-loop example, zero the pump curve (or toggle a `failed` flag) → `Q` collapses toward zero (hydrostatic only). Restore → Golden B returns.

### E8. Unit toggle

SI ↔ IP on the series-pipe example. Displayed head is 15 m ↔ 49.21 ft; stored SI JSON unchanged.

### E9. Irrigation emitter (repo-specific core)

One pressurized boundary + emitter to atmosphere. Change `P` from 100 kPa to 150 kPa → `Q` scales by `sqrt(1.5)`. This is the smallest e2e that proves Hydro-Flow is not only an electronics-cooling clone.

### E10. Schema / inspector errors

Disconnect a link, solve, get a readable error naming the link. Do not crash the worker.

---

## 6. Paper-replay scenarios (should, not P0 must)

Use these as documented scenarios once the component pack exists. They are **qualitative** unless a figure is digitized.

| Id | Paper | What to rebuild | Pass condition |
|---|---|---|---|
| R1 | MF03 | 7-tube U-header cold plate, 5 gpm, header 7/16" vs 7/8" | larger header reduces max/min branch-flow ratio |
| R2 | MF03 | 5 cold plates, pump, HX, filter, reservoir, branch orifices; loads 0.3/0.4/0.5/3.0/4.0 kW; 6.8 gpm; HX exit 25 °C | identical orifices leave hot branches; tuned orifices pull every average surface T under 60 °C (energy pack) |
| R3 | MF04 | three microchannel sinks 70/120/200 W (or 160 W + 400 kW/m² on one sink — confirm against PDF before coding) | orifice balancing can pull every `T_b` under 40 °C |
| R4 | MF08 | six fans, perforated bypass plate 100% vs 36% open | 36% open raises processor-path flow toward the 14 CFM goal; 100% open starves it |
| R5 | MF08 | +16 in² exhaust | total system flow increases (paper: 162 → 197 CFM, +22%) |
| R6 | MF09 | sink + variable clearance | sink-flow fraction falls as clearance rises |
| R7 | MF13 | card cabinet, Rotron MajorAC-MR2B3 (0.8 in H2O, 240 CFM), 50% screens, straight vs 18° tapered bottom | taper flattens card-passage `Q` profile |
| R8 | MF14 | two fans 0.24 in H2O / 45 CFM, EMI 51% open | total flow near 66 CFM is a *historical* data point, not a 1% golden; FNM vs test was 65.8 vs 66.6 CFM |
| R9 | MF07 | two networks sharing an HX (external + internal) | product pattern: multi-graph + BC handoff, P3+ |
| R10 | MF11 | composite LCM → row → manifold | hierarchical curve reuse; hardware band 10% |
| R11 | MF01 / MF06 | two-fan PC / server | published timings and accuracy bands only; do not invent missing table cells |

MF01 fan / `B` values sometimes appear in secondary extracts (main 0.15 in H2O / 66 SCFM; PSU 0.28 in H2O / 74 SCFM; lumped `B` on DASD / CPU / memory / I/O). Re-read Tables 1–2 of the PDF before promoting them to goldens — HTML scrapes of those tables have disagreed with each other.

---

## 7. Hydro / irrigation scope the tests must eventually cover

MacroFlow lists irrigation, pipe networks, HVAC, and grain dryers as general-flow applications. This repo is named hydro-flow, so these are core, not extras, even though the published papers are mostly electronics.

| Capability | First test |
|---|---|
| Pipe + fittings + elevation | Goldens A–C |
| Pump curve + lift | Golden B |
| Emitter / dripper `Q = k P^x` | Golden D + E9 |
| Lateral with many emitters | pressure declines along the lateral; last emitter `Q` < first unless pressure-compensating (`x ≈ 0`) |
| Sprinkler nozzle | treated as emitter with its own `k, x` |
| PRV / pressure-reducing valve | downstream `P` capped at setpoint |
| Check valve | `Q` ≈ 0 when `Δp` reverses |
| Filter / strainer | `K` or `Δp(Q)` curve; later `K(t)` as it loads |
| Reservoir / tank | P0: boundary `pFixed`; P3: volume + `d(ρV)/dt` |
| Hazen–Williams option | same pipe as Golden C, HW coefficient for new steel / PVC; document the equivalent `Δp` rather than forcing DW identity |

Out of irrigation scope (say so in product scope): unsaturated soil / Richards equation, crop ET controllers, municipal water-quality (EPANET MSX), water-hammer MOC.

---

## 8. Mapping advertised MacroFlow features → test phase

| Advertised feature | First test phase | Essential now? |
|---|---|---|
| Drag-drop network, connect ports | E1 | yes |
| Geometry → correlation, or curve, or table | U7, I6 | yes (curve + DW) |
| Fluid library 50+ | U15 + a water/air/glycol trio | water first |
| Steady incompressible | I1 | yes |
| What-if / contingency (fan fail, ambient rise) | I5, E7 | yes (fan fail) |
| Bar charts, tables, CSV | E5 | table/CSV yes |
| On-canvas results | E2 | yes |
| Particle animation | later e2e | no |
| Custom units | E8 | yes |
| Solution controls (relax, tol, maxIter) | U14 | yes |
| Transient tanks / purge charge | P3 | no |
| Compressible to choke | P3 | no |
| Radiation | P2+ | no |
| Vendor SKU catalogs | never copied | n/a |
| Chip-level temperatures | never | n/a |
| CFD coupling (MF14 workflow) | import `Δp(Q)` CSV | P2 |

---

## 9. Non-goals that tests should refuse to encode

- Bit-identical results with a MacroFlow binary (no public file format, no public manual).
- Digitizing Lytron / Comair-Rotron / Entegris / Mott / UAF / Aeroquip catalogs.
- 3-D velocity fields inside a component.
- Free-surface 2-D flooding, two-phase flow, method-of-characteristics water hammer.
- Treating MF06 CFM tables as 1% goldens (altitude, transitional `n ≠ 2`, 10–18% hardware band).

---

## 10. Suggested implementation order for the test suite

1. U1–U9 + I1 against `examples/` and `tests/fixtures/goldens.json`.
2. U12–U14 + E1–E3 + E6 so the editor cannot lie about convergence.
3. E9 + lateral-of-emitters (hydro identity).
4. I2, I4, I5 (paper-shaped integration without needing digitized figures).
5. U10 energy identity, then R2 as a scenario.
6. I6 composite components before any large manifold UI.
7. Only then attempt R4–R8 as optional research fixtures.
