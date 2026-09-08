# Workflows, domain scope, and acceptance tests

Companion to `docs/MACROFLOW_RESEARCH.md`. This document turns the vendor product and the MF01–MF15 papers into **what Hydro-Flow must do**, **what it must not do**, and **which tests are essential** before the clone is trustworthy.

It does not implement anything. Numeric P0 goldens already live in `tests/fixtures/goldens.json` and `examples/`.

---

## 1. What we are actually cloning

MacroFlow is a **system-level 1-D Flow Network Modeling (FNM)** tool. The core loop, published in Belady / Kelkar / Patankar (*Electronics Cooling*, January 1999) and restated in every later paper, is:

1. Draw the physical flow paths as a graph of **nodes** (pressure, temperature) and **links** (flow).
2. Give each link an overall constitutive law — handbook correlation, vendor/test curve, or user function — not a 3-D mesh.
3. Solve mass, momentum, and energy over that graph with a SIMPLE pressure-correction method and a direct matrix solve.
4. Inspect $Q$, $\Delta p$, and $T$ on the canvas, in charts and tables, and via particle animation.
5. Duplicate the model and change one thing (header diameter, orifice, fan fail, bypass area).

That loop is the product. Hydro-Flow clones the loop for **incompressible water networks first**, then the advertised general-flow and electronics-cooling packs. It does not clone the MacroFlow name, Win32 chrome, unpublished file format, or third-party vendor catalogs.

---

## 2. Scope that must be in the product (not just the solver)

### 2.1 User workflows that define “done”

These are the workflows the original GUI was built around. A web clone that only has a solver library is incomplete.

| ID | Workflow | Why it is core |
|---|---|---|
| W1 | New project → pick fluid + unit system + steady/incompressible | Every MF paper starts here |
| W2 | Place reservoirs / junctions; connect with pipes / pumps / valves / orifices | Network construction |
| W3 | Edit a component three ways: geometry+correlation, function, or $Q$--$\Delta p$ / $H$--$Q$ curve | Explicit on the general-flow page |
| W4 | Solve and see residuals, status, warnings | Solution-control dialogs in the original |
| W5 | Read $P$ on nodes and $Q,\Delta p,V,\mathrm{Re}$ on links **on the canvas** | “On-screen display of results” |
| W6 | Bar chart of branch flows; pump curve vs system curve | Primary design plot in liquid-cooling papers |
| W7 | Table + CSV export in the current display units | Advertised export |
| W8 | Save / load versioned JSON (`version` 0.1.0) | Original format is unpublished; this is ours |
| W9 | Duplicate project, change one parameter, compare $Q$/$P$ side by side | “What-if” / contingency, every paper |
| W10 | Size a component to a target $Q$ or $\Delta p$ (orifice diameter, pump speed) | MF03 orifice balancing; advertised “size individual components” |

Later, not P0, but still in the vendor product:

| ID | Workflow | Source |
|---|---|---|
| W11 | Transient tank fill / blowdown | General-flow page: steady or unsteady |
| W12 | Compressible link up to choke | General-flow page |
| W13 | Energy solve + radiation boundary | General-flow page; MF03 / MF04 thermal |
| W14 | Particle animation (speed $\propto Q$ or $V$, color $\propto T$ or $P$) | General-flow postprocessing |
| W15 | Import a CFD or lab $\Delta p(Q)$ table as a component | MF08 CPU sink from Flotherm; MF14 coupling |

### 2.2 Hydro / irrigation domain pack (repo-specific, vendor-advertised)

The vendor lists **irrigation systems** next to HVAC, automotive cooling, grain dryers, and semiconductor delivery. Hydro-Flow treats that pack as first-class rather than an afterthought.

| Component | Constitutive law | Notes |
|---|---|---|
| Pipe / lateral | Darcy–Weisbach + minor $K$ + optional Hazen–Williams | Elevation is first-class |
| Fitting (elbow, tee, wye) | Idelchik / Crane $K$, direction-dependent on tees | MF13 / MF03 will fail without tee inertia |
| Orifice / PRV / gate / ball | $K$ or $C_d A$ | MF03 / MF04 / MF11 balancing device |
| Pump | $H(Q)$ or $\Delta p(Q)$ curve | Affinity laws later |
| Filter / strainer | $K$ that can grow with time later | Advertised filtration |
| Emitter / dripper | $Q = k P^{x}$ | Golden case D already specified |
| Sprinkler | $Q(P)$ curve or $k P^{x}$ | Same family as emitter |
| Reservoir / tank / pond | Fixed $P$ or $P(\text{level})$ | Transient W11 |
| Open channel / weir | Out of P0–P2 | Do not pretend FNM is HEC-RAS |

Convention already locked by `tests/fixtures/README.md`:

- Water 20 °C: $\rho = 998.2\,\mathrm{kg/m^3}$, $\mu = 1.002\times 10^{-3}\,\mathrm{Pa\,s}$
- $g = 9.80665$, $P_\mathrm{atm} = 101325\,\mathrm{Pa}$
- Example `pFixed` values **already include** $P_\mathrm{atm} + \rho g z$. Link models must **not** add $\rho g \Delta z$ again.

### 2.3 Electronics-cooling pack (parity with advertised MacroFlow, later phase)

Keep in scope as a library, not as P0 UI:

- Fan / blower curves (in H2O vs SCFM is a display unit, SI internally)
- Heat sink as parallel rectangular channels + bypass gaps (MF09)
- Cold plate / microchannel as $R_\mathrm{th}(Q)$ plus $\Delta p(Q)$ (MF03, MF04)
- Heat exchanger effectiveness-NTU or UA
- Screen / filter / perforated plate open-area $K$
- Multiplicity factor on a link (“four identical card channels”, MF01)

Do **not** ship Lytron / Comair-Rotron / Entegris / Mott / UAF / Aeroquip / JMC / DAE catalogs. Support user-imported curves only.

### 2.4 Explicit non-goals

Copied from the papers so we do not “fix” FNM into CFD:

- Chip / junction temperatures and board-level thermal maps (MF01, MF08).
- Systems whose flow paths cannot be identified (sealed buoyancy cabinets).
- 3-D velocity fields inside a component.
- Water-hammer / surge (that is AFT Impulse / FloMASTER transient wave, not advertised FNM MVP).
- Two-phase / boiling / condensation.
- Copying MacroFlow artwork, dialog layout, or the unpublished Users Manual.
- Treating 10–18 % agreement with hardware (MF06, MF11) as a failure of Hydro-Flow goldens. Those papers measure *model + correlation* error. Analytic goldens stay at **1 % on $Q$**.

---

## 3. Physics the tests must lock down

### 3.1 Constitutive laws

Published forms (use SI in tests):

$$
\Delta p = K \rho \left(\frac{Q}{A}\right)^{n}
\qquad n \approx 2 \text{ turbulent minor loss}
$$

$$
\Delta p = \left(f \frac{L}{D} + K\right) \frac{\rho V^{2}}{2}
\qquad V = \frac{Q}{\pi D^{2}/4}
$$

$$
\mathrm{Re} = \frac{\rho |V| D}{\mu}
\qquad
f =
\begin{cases}
64/\mathrm{Re} & \mathrm{Re} < 2300 \\
\text{Swamee–Jain} & \mathrm{Re} \ge 2300
\end{cases}
$$

Fan / pump: interpolate $H(Q)$ or $\Delta p(Q)$. Positive $Q$ from `from` → `to` produces a pressure *rise*.

Emitter: $Q = k [\max(P_\mathrm{up}-P_\mathrm{dn},0)]^{x}$.

Energy (not P0, but specify now):

$$
\mathrm{Nu} = C\,\mathrm{Re}^{m}\,\mathrm{Pr}^{n}
\qquad
q = h A (T_s - T_b)
\qquad
R_\mathrm{th}(Q) = (T_s - T_\mathrm{in}) / \dot{Q}_\mathrm{heat}
$$

### 3.2 Conservation and solver contract

From MF01 / MF03 / MF13:

- Nodes hold $P$ (and later $T$). Links hold $Q$.
- $\sum \rho Q_l = 0$ at every internal node.
- SIMPLE: guess $Q,P$ → update $Q$ from linearized momentum → direct pressure-correction → energy → iterate.
- Under-relaxation and residual tolerance are user-visible.
- Status must distinguish `converged | max-iter | diverged | singular | choked`.

### 3.3 Accuracy bars

| Class | Bar | Source |
|---|---|---|
| Analytic hydro goldens A–D | $\lvert Q_\mathrm{calc}-Q_\mathrm{ref}\rvert / Q_\mathrm{ref} \le 1\%$ | `tests/fixtures/goldens.json` |
| Mass residual at junctions | $\lvert\sum Q\rvert$ below project tolerance (default $10^{-8}\,\mathrm{m^3/s}$ scale) | schema |
| Paper-scale hardware | 10–18 % on $Q$ is historically acceptable | MF06 vs prototype; MF11 vs assembled manifold |
| FNM vs CFD of same network | ~10–12 % on branch $Q$ | MF08 Case B |

Do not regress goldens A–D to the looser hardware bar.

---

## 4. Essential unit tests

These tests have no canvas. They protect the engine. If any fail, do not ship a solve button.

### 4.1 Fluid and friction primitives

| Test | Input | Expect |
|---|---|---|
| U1 laminar $f$ | $\mathrm{Re}=1000$ | $f = 0.064$ |
| U2 Churchill f | $\mathrm{Re}=88060$, $\varepsilon/D=4.5\mathrm{e}{-5}/0.05$ | $f \approx 0.022280$ (golden A pipe-1) |
| U3 Re definition | $Q=3.471278803556\mathrm{e}{-3}$, $D=0.05$ | $\mathrm{Re}\approx 88060$ |
| U4 area | $D=0.05$ | $A=\pi D^2/4$ |
| U5 water constants | — | $\rho=998.2$, $\mu=1.002\mathrm{e}{-3}$ |

### 4.2 Single-link invert $\Delta p \leftrightarrow Q$

| Test | Input | Expect |
|---|---|---|
| U6 series pipe-1 | $L=50,D=0.05,K=0.5,Q$ from golden A | $\Delta p \approx 35531.80\,\mathrm{Pa}$ |
| U7 series pipe-2 | $L=50,D=0.04,K=1.0$ | $\Delta p \approx 111303.18\,\mathrm{Pa}$ |
| U8 invert uniqueness | given $\Delta p$ from U6 | recovered $Q$ within 1 % |
| U9 reverse flow | negative $\Delta p$ | $Q$ flips sign, $\lvert Q\rvert$ matches |
| U10 $Q\to 0$ | tiny $\Delta p$ | no NaN, Jacobian regularized |

### 4.3 Machines and emitters

| Test | Input | Expect |
|---|---|---|
| U11 pump polynomial | $H=30-2000 Q^2$ at $Q=5.040585921353\mathrm{e}{-3}$ | $H\approx 29.949\,\mathrm{m}$ |
| U12 pump table | sampled curve in `examples/pump-loop.hydroflow.json` | same $H$ within interp tolerance |
| U13 emitter calibration | $2.0\,\mathrm{L/h}$ at $100\,\mathrm{kPa}$, $x=0.5$ | $k=1.756820922316\mathrm{e}{-9}$ SI |
| U14 emitter 150 kPa | that $k$ | $Q=6.804138174398\mathrm{e}{-7}\,\mathrm{m^3/s}$ $=2.4495\,\mathrm{L/h}$ |
| U15 emitter negative head | $P_\mathrm{up}<P_\mathrm{dn}$ | $Q=0$, no complex numbers |

### 4.4 Conservation and hydrostatics

| Test | Expect |
|---|---|
| U16 two identical pipes in series | midpoint $P$ splits the *frictional* drop; mass $\sum Q=0$ |
| U17 two identical pipes in parallel | each branch $Q$ equals the single-pipe $Q$; total $=2Q$ (golden C) |
| U18 no extra $\rho g z$ | using example `pFixed` as-is, golden A $Q$ matches; adding $\rho g\Delta z$ on links **must fail** this test |
| U19 missing pressure BC | status `singular` or a clear warning, not a hang |
| U20 disconnected node | warning, not a silent wrong solve |

---

## 5. Essential integration tests (JSON in, results out)

Load the real example files. No UI.

| Test | File | Must match goldens.json |
|---|---|---|
| I1 | `examples/series-pipes.hydroflow.json` | Case A $Q$, $P_\mathrm{mid}$, both pipe $\Delta p$ |
| I2 | `examples/pump-loop.hydroflow.json` | Case B $Q$ and pump $H$ |
| I3 | `examples/parallel-pipes.hydroflow.json` | Case C each branch and total $Q$ |
| I4 | schema required fields | file without `version` / `fluids` / `nodes` / `links` rejected |
| I5 | round-trip | parse → serialize → parse equals original on semantic fields |
| I6 | units are display-only | changing display units does not change stored SI $Q$ |

Pass criterion for I1–I3: relative error on $Q \le 1\%$, residual under the example tolerance, `status=converged`.

---

## 6. Essential end-to-end tests (editor + solver)

These are product tests. They can be manual until a browser runner exists; they are still **required** for a release.

### 6.1 Editor mechanics

| Test | Steps | Pass |
|---|---|---|
| E1 Load example | File → load series-pipes JSON | Three nodes, two pipes, names visible |
| E2 Solve overlay | Press Solve | Mid node shows $\approx 261.6\,\mathrm{kPa}$; both links show the same $Q\approx 3.47\,\mathrm{L/s}$ |
| E3 Inspector edit | Change pipe-2 $D$ from 0.04 to 0.05, Solve | $Q$ increases; $P_\mathrm{mid}$ moves |
| E4 Add branch | Add a parallel pipe mid→res-lo, Solve | Mass at mid still balances |
| E5 Export JSON | Save | Reloading reproduces the graph and last results block |
| E6 Export CSV | Export results table | One row per link with $Q,\Delta p,V,\mathrm{Re}$ |
| E7 What-if compare | Duplicate, raise upstream $pFixed$ 10 %, compare | Δ$Q$ shown, both projects remain |
| E8 Bad network | Delete the only pressure boundary, Solve | Visible error, canvas not blanked |
| E9 Units toggle | Switch kPa ↔ psi | Numbers convert; stored SI unchanged |

### 6.2 Paper-inspired system tests (qualitative e2e)

These do **not** need digitized figure points. They lock the *design behavior* the papers exist to show. Build each as an example project later; until then they are acceptance scripts.

**S1 — MF03 cold-plate headers (manifold maldistribution)**

- 7 identical laterals off a header, total $5\,\mathrm{gpm}$ water.
- Small header diameter → first laterals take most of the flow.
- Double (or larger) header diameter → branch $Q$ much more uniform.
- Pass: $\max Q_i / \min Q_i$ drops substantially when the header is enlarged. Tees must be present; replacing tees with plain junctions should worsen the small-header case.

**S2 — MF03 five-branch orifice balance**

- Five parallel cold plates, loads $0.3,0.4,0.5,3.0,4.0\,\mathrm{kW}$.
- Identical branch orifices: low-power branches over-flow.
- Independent orifice $K$ per branch: flow can be shifted toward EU-4 and EU-5.
- Pass: user can raise $K$ on EU-1/EU-2 and see their $Q$ fall. Energy/$R_\mathrm{th}$ can wait; flow shift is the P1 bar.

**S3 — MF09 heat-sink bypass**

- One sink path in parallel with a clearance path, fixed total $Q$.
- Increase bypass area → sink $Q$ fraction falls.
- Pass: sink fraction is near 1 with a sealed bypass and clearly lower with a large bypass. Direction matches the paper (they plot down to $\sim 0.2$).

**S4 — MF13 tapered manifold**

- Fan + bottom header + $N$ card takeoffs + tees.
- Constant-section header: downstream cards hog flow (inlet inertia).
- 18° taper: takeoff $Q$ more uniform.
- Pass: taper reduces $\max Q / \min Q$ across takeoffs. Requires direction-dependent tee $K$.

**S5 — MF08 / MF01 fan fail**

- Two or more fans in parallel plus a system curve.
- Disable one fan (remove curve or set $Q=0$ device).
- Pass: remaining fans move out on their curves, total $Q$ drops, no crash if a fan would run near stall — warn instead.

**S6 — MF11 hierarchical manifold**

- Sub-network for one branch (LCM), then $N$ copies on a header.
- Pass: a multiplicity or copied sub-graph produces $N$ times the single-branch flow when headers are generous; maldistribution appears when the header is tight. Hardware paper claimed $\Delta p$ within 10 % — our bar is qualitative until we have our own measured $K$.

**S7 — Irrigation drip lateral (Hydro-Flow specific)**

- Reservoir → main → lateral with 10 emitters $Q=kP^{0.5}$.
- Pass: distal emitters see lower $P$ and lower $Q$ than proximal ones; enlarging the lateral $D$ flattens the $Q$ profile. Uses golden-D $k$.

---

## 7. Paper digest for test authors

Use this when writing examples. Full method discussion stays in `docs/MACROFLOW_RESEARCH.md`. Grok may also land `docs/PAPERS.md`; treat the numbers below as the working set.

| Paper | What to steal for tests | What not to treat as a golden |
|---|---|---|
| MF01 *Electronics Cooling* Jan 1999 | SIMPLE steps; $\Delta p=B Q^2$; multiplicity; two-fan chassis; limitations list | Graphical $Q$/$T$ figures; B-table scrape if garbled |
| MF02 HP RP8400 methodology | FNM then CFD; generic nodes for multi-exit fans | Fourteen layout count is process, not physics |
| MF03 InterPACK 2003-35233 | S1 and S2 geometries; 5 gpm / 6.8 gpm; 60 °C target; tee headers | Lytron catalog curves |
| MF04 microchannel | Laminar $f\mathrm{Re}$ and Nu by aspect ratio; orifice rebalance 33.1 / 42.3 / 49.8 °C → all $<40$ °C | Silicon conductivity details unless we add a microchannel component |
| MF05 telecom shelf | Recirculation path as a loop with a controlled leak | — |
| MF06 HP vs Ellison vs test | 14–18 % vs prototype is *historical* accuracy; $\Delta p \propto Q^{1.5}$ transitional warning | Do not hard-code 338/398 CFM as Hydro-Flow goldens |
| MF07 Lucent BTS | Two decoupled networks (external + internal); 1.7 kW, 52 °C ambient | Solar load model |
| MF08 Intel server | Best FNM-vs-CFD numbers (12 % CPU, ~10 % PCI); perforated-plate open area as a $K$ knob | Flotherm sink curve |
| MF09 IBM bypass | S3 geometry; 10 SCFM; $h=36.6\,\mathrm{W/m^2K}$ | Digitized figure points unless we digitize them ourselves |
| MF10 burn-in oven | Large parallel card array + recirculation | — |
| MF11 Teradyne manifold | Hierarchical model; ports as orifices; 10 % vs hardware | 13.6 psig as a golden without our $K$ |
| MF12 RF + CFD | FNM sizes the loop, CFD checks a passage | — |
| MF13 design process | S4; Rotron MajorAC-MR2B3 0.8 in H2O / 240 CFM; 18° taper; 50 % screens | Flow-only study |
| MF14 FNM+CFD | Impedance table component is the integration point | COMPACT-specific setup |
| MF15 power supply | Internal parallel paths + fan curve | — |

Handbook dependencies the unit suite should eventually exercise (P1+):

- Idelchik tee / elbow / sudden expansion
- Moody / Colebrook vs Swamee–Jain agreement at one $\mathrm{Re}$
- Perforated plate $K$ vs open area (MF08 Case A vs B)

---

## 8. Phased acceptance

Call a phase done only when the matching tests exist and pass, not when the UI looks right.

**P0 — hydro engine**

- Unit U1–U20
- Integration I1–I6
- Editor E1, E2, E5, E8 at minimum
- Components: pipe, junction, pressure boundary, pump curve, orifice/valve $K$, emitter
- No energy, no compressible, no animation

**P1 — productized editor**

- E3, E4, E6, E7, E9
- S7 drip lateral example in `examples/`
- Units registry; CSV export; what-if duplicate

**P2 — FNM thermal + paper behaviors**

- Energy unit tests (mixing two streams, $R_\mathrm{th}Q$ cold plate)
- S1, S2, S3, S5
- User curve import (W15)

**P3 — manifolds and motion**

- Direction-dependent tees; S4, S6
- Transient tank mass balance
- Particle animation W14

**P4 — advertised extras**

- Compressible-to-choke
- Radiation term
- Auto-size orifice / pump (W10 as a solver, not a hand edit)

---

## 9. Open questions to resolve in later docs, not in code guesses

**Resolved (ORN-37):** see `docs/OPEN_PHYSICS_DECISIONS.md`. Short form:

1. Node pressures are **static** absolute P. Do not reinterpret as stagnation.
2. Tee K: published Idelchik subset (default) + optional Gardel; citations locked in `src/engine/tee.ts`.
3. Pipe friction: **Churchill** for all Re (no 2300 hard cut). WORKFLOWS §3.1 Swamee–Jain form is pedagogical.
4. Fan/pump stall or reverse: **allow** with `hMin`/`dpMin` floor; **warn** under S5 (ORN-31), do not crash.
5. Multiplicity: add schema `multiplicity` before S6 (ORN-32); copied links stay valid for maldistribution.

Historical open wording kept for archaeology:

1. Are node pressures **static** or **stagnation**? Papers are sloppy. Hydro-Flow P0 should document static $P$ + separate $\rho V^2/2$ only if we add it.
2. Tee $K$ as a function of flow ratio: implement a published Idelchik subset and cite the chart numbers we use.
3. Transition $2300 < \mathrm{Re} < 4000$: goldens use a hard switch at 2300. MF08 interpolates $K$ between laminar and turbulent. Pick one and test it.
4. Fan stalled / running backwards: warn vs. allow. Papers assume forward on-curve operation.
5. Multiplicity vs copied links: MF01 used a multiplier of 4. Schema does not yet have `multiplicity`; add it before S6.

---

## 10. Related files

- `docs/MACROFLOW_RESEARCH.md` — method, competitors, architecture
- `docs/schema/hydroflow.project.schema.json` — project contract
- `examples/*.hydroflow.json` — P0 networks
- `tests/fixtures/goldens.json` — analytic $Q$/$P$/$H$
- `tests/fixtures/README.md` — hydrostatic convention
