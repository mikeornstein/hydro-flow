# MacroFlow Research Report

**Purpose:** Thorough research of Innovative Research LLC's MacroFlow so its *core functionality* can be reimplemented as a modern web app in this repository (`hydro-flow`).

**Date:** 2026-09-07  
**Primary source:** [https://inresllc.com/macroflow-overview.html](https://inresllc.com/macroflow-overview.html)  
**Scope:** Product, physics, solver, component library, UI/UX, competitors, proposed data model and architecture. Not a line-by-line clone of a proprietary binary.

---

## 1. Executive summary

MacroFlow is a **1-D Flow Network Modeling (FNM)** desktop application, not 3-D CFD. A physical flow system is drawn as a graph of components and flow paths. Each component carries *overall* flow and thermal characteristics (handbook correlations, vendor curves, or user tables). The engine then solves the discrete mass, momentum, and energy equations over that graph.

That is the product. Typical practical models solve in well under a minute (historically ~10–30 seconds on a Pentium 133). Engineers use it in conceptual design to size components, compare layouts, run what-if studies, and inspect contingency cases (fan failure, ambient rise, filter loading) *before* spending time on CFD.

The shipping product is a dated Windows 95/98/NT/2000/XP GUI: drag-drop component pallet, tab dialogs, bar charts / tables / particle animation. There is no public users manual, no published file format, no API, and no public pricing or trial. The underlying method *is* published in detail (Belady / Kelkar / Patankar, 1999 onward) and rests on standard hydraulics handbooks plus Patankar's SIMPLE algorithm.

**hydro-flow should reimplement the published FNM method in the browser**, starting with incompressible pipe/pump/valve networks (including irrigation), then adding heat transfer, transients, and compressible flow. Do not copy MacroFlow's name, artwork, vendor catalogs, or any unpublished binary artifacts.

---

## 2. Product and company

### 2.1 What MacroFlow is

From the vendor overview:

> MacroFlow is a software tool for rapid and accurate flow and thermal design of flow systems in engineering applications, including electronics cooling, semiconductor processing, and general flow systems. It uses Flow Network Modeling (FNM), which represents a flow system as a network of components and flow paths with overall flow and thermal characteristics. System behavior is determined through a system-level direct solution of the mass, momentum, and energy conservation equations.

Claimed productivity uses:

- Quick comparison of competing designs
- Sizing of individual components
- What-if studies
- Contingency / failure scenarios

Claimed industries:

- Electronics cooling — computer, telecom, defense, power
- Gas and liquid delivery in semiconductor processing
- Filtration and cooling in automotive and gas-turbine applications
- Also listed: HVAC, intake/exhaust, **irrigation systems**, grain dryers, cryogenics, mufflers, oil lubrication

Sister products from the same company family: **TileFlow** (3-D data-center CFD, inres.com) and **MeltFlow-VAR / MeltFlow-ESR** (specialty-alloy remelting CFD). MacroFlow is the 1-D network tool; TileFlow/MeltFlow are 3-D CFD. hydro-flow should stay on the FNM side of that line.

### 2.2 Company

| Item | Detail |
|---|---|
| Legal name | Innovative Research, LLC (reorg of Innovative Research, Inc. in 2014) |
| Founded | 1987 |
| Historical addresses | 2520 Broadway St NE, Suite 200, Minneapolis, MN 55413; 3025 Harbor Lane N, Plymouth, MN 55447 |
| Phone | 763.559.5050 |
| Emails in papers | kelkar@inres.com, amir@inres.com, patankar@inres.com; info@inresllc.com |
| Sites | [inresllc.com](https://inresllc.com/), [inres.com](https://inres.com/) |
| Staff (self-described) | Research engineers with advanced degrees; small private firm |

Key technical people appearing on the papers: **Suhas V. Patankar** (SIMPLE algorithm; *Numerical Heat Transfer and Fluid Flow*, 1980), **Kanchan M. Kelkar**, **Amir Radmehr**, **Patrick J. Kelly**. Named industrial co-authors / users: Christian Belady (HP), Robin Steinbrecher (Intel), Sukhwinder S. Kang (IBM), Nanqiang Zhu / Daniel Plaza / Craig Maitz (Lucent).

The product's public face is thin: a handful of static HTML pages, 15 downloadable PDFs, conference mentions through ~2018, and an advertised OS list that stops at Windows XP. There is no public version number, changelog, screenshot gallery beyond three captioned figures, or pricing page.

### 2.3 Documented screenshots / example models

On the overview and application pages:

- An air-cooled electronics cabinet
- Component pallet
- Air-flow system in a grain dryer
- Liquid-cooled avionic system
- Gas delivery system in semiconductor processing
- Fluid-property database UI
- Fuel delivery system in a gas-turbine engine
- Enhanced design-cycle flowchart (FNM early, CFD later)

The grain-dryer and irrigation mentions are the closest published examples to a hydro-oriented product.

---

## 3. FNM methodology and governing equations

### 3.1 Network representation

A physical system is a **graph**:

- **Nodes (junctions):** store pressure `P` and temperature `T`. Optional volume for tanks / plenums (needed for transients). Boundary nodes can fix `P` and/or `T`.
- **Links (components / flow paths):** store volumetric flow `Q` or mass flow `ṁ`. Each link has a constitutive relation `"ΔP = f(Q, geometry, fluid, state)"` and an optional heat-transfer relation.

There is no restriction on topology: loops, parallel paths, open or closed systems, multiple inlets/outlets are all allowed. Multiplicity (e.g. four identical card channels) is represented by a parallel multiplier rather than four copies.

FNM does **not** resolve velocity or temperature fields *inside* a component. Accuracy is that of the empirical characteristic used for that component. If flow paths themselves are undefined (large open buoyancy-driven cabinet), FNM is the wrong tool — the vendor says so explicitly.

### 3.2 Momentum / pressure drop

Published forms used in the MacroFlow papers:

**Power-law (MF13 and related):**

```text
Δp = K ρ (Q / A)^n
```

`n ≈ 1` in laminar friction, `n ≈ 2` in turbulent / minor-loss regimes. `K` comes from Idelchik, Blevins, Moody, vendor data, CFD of a single part, or test.

**Split form + friction (Electronics Cooling 1999):**

```text
Δp = (S·CR) ρ V² / 2  +  R ρ V² / 2
```

Linearized for the solver as something equivalent to:

```text
Δp = a Q + b
```

where `a` is the local slope of the `Δp(Q)` curve (Newton–Raphson) and `b` is the departure from linearity. Fans and pumps invert the same idea: they contribute a *rise* `Δp(Q)` from a catalog curve.

For hydro-flow MVP, implement the standard engineering equivalents rather than guessing unpublished internal coefficients:

- Darcy–Weisbach friction: `Δp = f (L/D) ρ V² / 2` with Swamee–Jain or Colebrook `f(Re, ε/D)`
- Minor losses: `Δp = K ρ V² / 2` (Crane TP-410 / Idelchik subset)
- Elevation: `Δp = ρ g Δz`
- Hazen–Williams (irrigation / water-only convenience)
- Pump / fan: piecewise-linear or polynomial `H(Q)` or `Δp(Q)` curve, plus optional affinity laws

### 3.3 Mass conservation

At every internal node:

```text
Σ ρ Q_l  =  ṁ_source
```

(Incompressible steady: `Σ Q_l = 0`.) Inlet positive / outlet negative is a sign convention only. Boundary nodes replace this with a prescribed `P` or `Q`.

### 3.4 Energy

Bulk temperature along a link from an energy balance. Heat into a stream:

```text
q = h A (T_s − T_b)
```

with

```text
h = Nu · k / D_h
Nu = C Re^m Pr^n
```

Mixing at nodes is an enthalpy-weighted average of incoming streams. Radiation to surroundings is listed as a product capability (additional `q_rad = ε σ A (T^4 − T_inf^4)` term). Effectiveness-NTU or UA models cover heat exchangers and cold plates.

FNM predicts **bulk fluid and average surface temperatures**, not chip-junction maps. The vendor is explicit: component-level temperatures need a board-level thermal network or CFD.

### 3.5 Fluid properties

Vendor claims a library of **50+ common fluids and gases** sourced from handbook data (W.C. Reynolds *Thermodynamic Properties in SI*; Carl Yaws / Matheson Gas Data Book).

User-defined property models advertised:

| Property | Models |
|---|---|
| Density | Ideal-gas law, compressibility factor, polynomial, piecewise table |
| Viscosity | Power law, Sutherland, polynomial, table |
| `c_p`, `k`, `β` | Polynomial or table |

Physics flags advertised: steady or unsteady; incompressible or compressible **up to choking**; convection and radiation; real-gas properties; mass and energy sources; open or closed loops; forced or (path-clear) natural convection.

### 3.6 What FNM is relative to CFD

| | FNM (MacroFlow) | 3-D CFD |
|---|---|---|
| Unknowns | `P`, `T` per node; `Q` per link | velocity / T / P on a mesh |
| Component internals | lumped characteristic | fully resolved |
| Setup time | ~1 hour for a cabinet | days–weeks |
| Solve time | seconds | minutes–hours |
| Role in design | conceptual / system / what-if | detailed / local |

The published design cycle is FNM first → keep only feasible layouts → CFD of those layouts and of parts whose characteristics are unknown.

---

## 4. Solver algorithm

The papers state that discretized momentum, continuity, and energy are solved with Patankar's **SIMPLE** pressure-correction method, with Newton–Raphson linearization of the nonlinear `Δp(Q)` curves, and a **direct** solve of the resulting pressure-correction matrix. Solution-control dialogs expose relaxation factors, convergence tolerances, and the matrix-inversion procedure.

### 4.1 Steady algorithm (implement this)

1. Guess `Q` on every link and `P`, `T` on every node.
2. From current `Q`, evaluate each link constitutive law and its Jacobian; form a linearized momentum statement `P_up − P_dn = a Q + b` (plus pump rise, elevation, density-head).
3. Combine linearized momentum with nodal continuity into a **pressure-correction** system `A p' = r`.
4. Solve `A p' = r` with a dense LU (MVP, N ≲ 500) or sparse direct solver (KLU / SuiteSparse).
5. Correct `P` and `Q`. Under-relax (`α_P ≈ 0.7`, `α_Q ≈ 0.5–0.8`).
6. Solve the discrete energy system for `T` (upwind enthalpy + heat sources).
7. Update `ρ(T,P)`, `μ(T)` if variable-property or compressible.
8. Repeat 2–7 until mass and energy residuals fall below tolerance (e.g. 1e-6 to 1e-8) or `maxIter` (100–200).

Fan / pump curves enter as a source term in the link momentum equation (interpolate `Δp(Q)` and `d(Δp)/dQ`). Choking: when a restriction reaches `Ma → 1`, freeze the mass flow at the choked value and continue.

### 4.2 Transient extension

Advertised. Implement later as implicit Euler (or BDF2) on storage nodes:

```text
d(ρ V)/dt  +  Σ ṁ = ṁ_src
```

Pipes themselves stay algebraic (inertial pipe wave models are a phase-3 option, not MVP).

### 4.3 Solver API for hydro-flow

```ts
type Status = "converged" | "diverged" | "max-iter" | "choked" | "singular";

interface NodeResult { P: number; T: number; H?: number }
interface LinkResult {
  Q: number; mdot: number; dP: number; V: number; Re: number;
  f?: number; Nu?: number; q?: number; Mach?: number;
}

interface SolveResult {
  status: Status;
  iterations: number;
  residuals: number[];
  nodes: Record<string, NodeResult>;
  links: Record<string, LinkResult>;
  warnings: string[];
  elapsedMs: number;
}

function solveSteady(project: Project): SolveResult;
function solveTransient(project: Project): SolveResult[];
```

Run the solver on a **Web Worker** so the canvas stays interactive. TypeScript is enough for the first few hundred nodes. Promote hot paths to WASM only if a real model demands it.

---

## 5. Component library and fluid database

### 5.1 Geometric / standard components (general flow)

From the general-flow product page:

- Pipes, ducts, logical connections
- Elbows, tees, wyes, crosses (arbitrary angle)
- Fans, pumps, blowers
- Nozzles, exhausts, intakes, with or without screens
- Screens and orifices
- Air filters and ultra-high-purity gas filters
- Diffusers and expanders
- Plenums and tanks
- Valves: pressure, timing, ball, swing, gate, "and many more"
- Generic resistances
- Customizable node

Each component is edited through a tab dialog: geometry → built-in correlation, **or** a functional form, **or** a vendor curve, **or** a user table. User correlations can be attached to any type.

### 5.2 Electronics-cooling extras

Fan/pump, heat sink, cold plate, heat exchanger, air filter, screen, quick disconnect.

### 5.3 Embedded vendor libraries (do **not** copy)

Documented catalogs — treat as *capability to import curves*, not data to scrape:

- Heat exchangers and cold plates — Lytron
- Quick disconnects — Aeroquip
- Fans — Dynamic Air Engineering, Comair-Rotron, JMC Products
- Air filters — Universal Air Filter
- High-purity gas filters — Entegris, Mott

### 5.4 Hydro-flow additions (repo-specific)

Given this repository's name and MacroFlow's listed irrigation use case, add first-class irrigation / water-distribution types on the same engine:

- Laterals and manifolds
- Emitters / drippers (pressure-compensating and not: `Q = k P^x`)
- Sprinklers / rotors / sprays
- Control valves, PRVs, check valves
- Filters / strainers (degrading `K(t)` later)
- Pumps with catalog curves + NPSH warning
- Reservoirs / tanks / ponds
- Water meters / flow sensors (results probes, not resistances)

### 5.5 Units

Original: mixed SI / IP, user-defined units that propagate globally and are stored in a unit library. hydro-flow should keep a unit registry and persist values in SI internally.

---

## 6. Original UI / UX (what to recreate, not copy)

Unified visual environment — construct, solve, and inspect in one workspace.

**Construct**

- Component pallet of icons
- Mouse-driven place + connect (port-to-port)
- Infinite 2-D canvas; layout is schematic, not to-scale geometry (elevation is a property)
- Inspector / tab dialog per selected component

**Solve**

- Menus / dialogs for relaxation, convergence, matrix method
- Fast enough that iterate-inspect-tweak is the loop

**Inspect**

- On-canvas numeric overlays (click a component, see `Q`, `ΔP`, `T`, `Re`)
- Bar charts and X-Y plots (pump curve vs. system curve is the money plot)
- Tables with user units, CSV export
- Animation: colored particles along links; speed ∝ `Q` or `V`, color ∝ `T` or `P`
- Multi-select by rubber-band, not by typing names
- Image export of the workspace (bmp/gif/jpg/png/tif in the original) and CSV of tables

**Workflow to support in the clone**

1. New project → fluid + unit system + analysis type
2. Drag components, connect ports
3. Edit geometry / curve / BC
4. Solve, watch residuals
5. Read results on canvas + charts + tables
6. Duplicate the project, change one thing (fan fail, pipe size, emitter count), compare
7. Export CSV / PNG / JSON

Do **not** reproduce Windows-95 chrome, proprietary icons, or the three marketing screenshots.

---

## 7. Applications and published case studies

Papers hosted at [inresllc.com/macroflow-publications.html](https://inresllc.com/macroflow-publications.html):

| ID | Title |
|---|---|
| MF01 | Improving Productivity in Electronic Packaging with Flow Network Modeling |
| MF02 | Thermal Design Methodology for Electronic Systems |
| MF03 | Analysis and Design of Liquid-Cooling Systems Using FNM |
| MF04 | Liquid Cooling System with Microchannel Heat Sinks |
| MF05 | Partial Recirculation Scheme for a Telecom Shelf |
| MF06 | FNM: A Case Study in Expedient System Prototyping |
| MF07 | Thermal Design of a Base Transceiver Station |
| MF08 | FNM for the Design of an Air-Cooled Server (Intel) |
| MF09 | Effect of Flow Bypass on Heat-Sink Performance (IBM) |
| MF10 | Design of a Burn-in Oven |
| MF11 | Intricate Cooling Manifold |
| MF12 | RF Absorption Cooling, FNM + CFD |
| MF13 | Enhancing the Design Process of Electronic Cooling Systems |
| MF14 | Coupling FNM and CFD on an Electronics Enclosure |
| MF15 | Flow Distribution in a Power Supply |

These are the best public specification of how the tool was actually used. Recurring pattern: build the network from mechanical drawings + handbook K-factors + vendor fan curves; iterate layouts; only then CFD.

General-flow examples listed on the product site (useful test-case ideas): auto A/C compressor valve timing; avionics fan fail; single vs dual exhaust back-pressure; semiconductor gas sticks with MFCs and UHP filters (including purge charge/discharge); engine intake/exhaust manifolds; oil lubrication; HVAC; filtration; mufflers; pipe networks; coolers/dryers; cryogenics; **irrigation**.

---

## 8. Competitive landscape

MacroFlow lives in the gap between a spreadsheet and 3-D CFD. That category is now dominated by enterprise 1-D codes. A web-native hydro-first FNM tool is still thinly served.

| Tool | Vendor | Notes vs hydro-flow |
|---|---|---|
| Simcenter Flomaster | Siemens | Gold-standard 1-D systems, transients, 1D–3D co-sim. Enterprise desktop. |
| AFT Fathom / Arrow | Datacor | Rigorous liquid / compressible-gas pipe networks, NPSH. Desktop. |
| PIPE-FLO | Engineered Software | Approachable piping. Weak thermal-system story. |
| Flownex | M-Tech | 1-D + ANSYS. Enterprise. |
| PIPENET | Sunrise | Fire protection and general piping. Desktop. |
| Pipe Flow Expert / Wizard | PipeFlow | Mid-market networks, 400+ fluids, good reports. |
| FluidFlow | Flite | Liquid / gas / two-phase pipe networks. |
| KYPipe | KYPipe | Municipal / industrial water. |
| Simcenter Amesim | Siemens | Multi-domain 1-D (auto thermal). Heavier than FNM. |
| EPANET / epanet-js | EPA / OWA | Open water-distribution engine; WASM exists. Water-only, no thermal, no fans/HX. Best open hydraulics reference. |
| pandapipes | Fraunhofer | Python gas + district heat. No product-grade editor. |
| SimuPipe | simupipe.com | **Closest existing web analog** — browser canvas, Darcy–Weisbach, Newton solver, ~38 fluids. Beat it with thermal + irrigation components + animation + what-if. |
| h2x Engineering | h2x | Web hydronic / plumbing sizer. Pattern reference, not an FNM engine. |
| Flotherm / Icepak | Siemens / Ansys | 3-D electronics CFD. Complementary, not a competitor to FNM. |

**Positioning line:** hydro-flow = published FNM physics (Patankar SIMPLE + handbook hydraulics) + a modern web canvas + a hydro / irrigation component pack. Not a Flomaster clone and not a 3-D CFD tool.

Open-source building blocks worth using, not wrapping blindly:

- [epanet-js](https://epanetjs.com/) / [OpenWaterAnalytics/EPANET](https://github.com/OpenWaterAnalytics/EPANET) — water-network solver reference and WASM precedent
- [pandapipes](https://www.pandapipes.org/) — Python network solver reference
- CoolProp (WASM build) — optional high-quality fluid properties
- React Flow / XYFlow — node-link editor
- Crane TP-410 and Idelchik — implement a *subset* of correlations ourselves from the public handbooks

---

## 9. Limitations of the original — and what not to copy

Vendor-stated limits:

- No component-level (chip) temperatures
- Accuracy = validity of the resistance correlations
- Unusable when flow paths are not well defined
- Weak story for sealed buoyancy-driven enclosures unless paths can be identified

Product limits we should **not** reproduce:

- Windows-only desktop, Win95–XP era UI
- No collaboration, versioning, or mobile
- No public file format or API
- Stale vendor catalogs locked inside the binary
- No documented automated test suite or published verification cases beyond paper figures

IP / ethics:

- Reimplement from **published equations** and **public handbooks**.
- Do not reverse-engineer the MacroFlow binary or users manual.
- Do not copy name, logos, icons, screenshot assets, or vendor numerical catalogs.
- Do not scrape Lytron / Comair-Rotron / Entegris / Mott / UAF / Aeroquip / JMC / DAE data.
- File format is unpublished — design a clean versioned JSON schema of our own.
- "MacroFlow" and "Flow Network Modeling" as used here are the vendor's product terms; this project should ship as **hydro-flow**.

---

## 10. Recommended modern architecture

```text
┌── Browser ─────────────────────────────────────┐
│  XYFlow / React Flow canvas                                         │
│  Zustand + Immer project store                                      │
│  Inspector + palette + charts (uPlot / Observable Plot)             │
│  Particle overlay (canvas)                                          │
│                               │                                      │
│                               ▼ postMessage                           │
│  Web Worker: assemble + SIMPLE + energy                             │
│  Fluids: JSON tables now, CoolProp WASM later                       │
└───────────────────────────────────────────────┘
        │ JSON project file
        ▼
  IndexedDB  ↔  optional cloud / Git persistence
```

Suggested app shell:

1. Editor canvas + left palette + right inspector
2. Solve panel (residual sparkline, iterate / stop)
3. Results overlay on nodes / edges with a color scale
4. Charts pane (branch flows, pump vs system curve)
5. Table pane + CSV
6. Side-by-side design compare (two project snapshots)
7. Particle animation toggle

Persistence: a single versioned JSON document (schema below). IndexedDB for local drafts; download / open file for interchange.

---

## 11. Proposed project JSON (v0.1)

```json
{
  "version": "0.1.0",
  "meta": {
    "name": "example-loop",
    "description": "",
    "createdAt": "2026-09-07T00:00:00Z",
    "updatedAt": "2026-09-07T00:00:00Z"
  },
  "units": {
    "system": "SI",
    "length": "m",
    "pressure": "Pa",
    "flow": "m3/s",
    "temperature": "K",
    "power": "W"
  },
  "fluid": {
    "id": "water",
    "name": "Water",
    "model": "constant",
    "rho": 997,
    "mu": 8.9e-4,
    "cp": 4182,
    "k": 0.598,
    "beta": 2.1e-4
  },
  "analysis": {
    "type": "steady",
    "flowRegime": "incompressible",
    "energy": false,
    "gravity": true,
    "convergence": {
      "massResidual": 1e-8,
      "energyResidual": 1e-8,
      "maxIter": 100,
      "relaxationP": 0.7,
      "relaxationQ": 0.8
    }
  },
  "nodes": [
    {
      "id": "n1",
      "kind": "boundary",
      "x": 0, "y": 0, "z": 0,
      "pFixed": 101325,
      "tFixed": 293.15
    }
  ],
  "links": [
    {
      "id": "c1",
      "from": "n1",
      "to": "n2",
      "component": {
        "type": "pipe",
        "geometry": { "L": 10, "D": 0.05, "eps": 4.6e-5, "dZ": 0 },
        "lossModel": "darcy-weisbach",
        "K": 0
      }
    }
  ]
}
```

**Node kinds:** `junction` | `boundary` | `tank` | `plenum`

**Link types (MVP set first):** `pipe`, `duct`, `elbow`, `tee`, `orifice`, `valve`, `pump`, `fan`, `filter`, `generic-resistance`, `heat-exchanger`, `emitter`, `sprinkler`, `lateral`

**Loss models:** `darcy-weisbach` | `hazen-williams` | `k-factor` | `idelchik` | `curve` | `table`

**Fluid models:** `constant` | `ideal-gas` | `polynomial` | `table` | `coolprop`

**BC types:** fixed pressure, fixed flow, fixed temperature, specified heat, none (internal).

Results are a sibling object (`nodeP`, `nodeT`, `linkQ`, `linkDP`, residuals, warnings) so a saved file can optionally include the last solve.

---

## 12. hydro-flow MVP scope (phased)

### P0 — prove the engine (target: a loop you can edit and solve in the browser)

- React Flow canvas, palette, inspector
- Nodes: junction, pressure boundary
- Links: pipe, fitting (`K`), pump (curve), valve (`K` or opening)
- Fluid: constant-property water
- Physics: incompressible steady, Darcy–Weisbach + Swamee–Jain + elevation
- SIMPLE / Newton solver in a worker
- On-canvas `P` and `Q`, residual log, JSON save/open

**Acceptance:** a two-reservoir pipe + pump model matches a hand calc / EPANET-style result within 1% on flow.

### P1 — hydro / irrigation pack + reporting

- Emitters `Q = k P^x`, laterals, sprinklers, filters, check / PRV
- Hazen–Williams option
- 20–50 fluid table (water, seawater, glycol mixes, air — computed, not scraped)
- Bar charts, pump-vs-system curve, CSV export
- Unit system SI / IP toggle

### P2 — energy and what-if

- Energy equation, Nusselt correlations, UA / ε-NTU HX
- Fans, heat sinks, generic heat sources (electronics path)
- Duplicate-and-compare designs; fan-fail / valve-fail cases
- Particle animation

### P3 — transients and compressible

- Tank / plenum volume, implicit Euler
- Ideal-gas + choking at orifices / valves
- Filter degradation `K(t)` and purge charge/discharge demos

### P4 — productization

- User curve import (CSV)
- Parametric sweep (pipe D, pump speed, emitter count)
- PDF / HTML report
- Optional CoolProp WASM
- Shareable project URLs

Out of scope forever (leave to CFD): intra-component 3-D flow, chip-junction maps, free-surface 2-D flooding, water-hammer method-of-characteristics unless a later explicit decision says otherwise.

---

## 13. Verification plan

Build a `tests/solver` suite before trusting the UI.

1. Single pipe, laminar and turbulent — Darcy–Weisbach closed form.
2. Two pipes in series / parallel — exact split.
3. Pump + system curve intersection — known polynomial pump + known system `K`.
4. Elevation head only — hydrostatic.
5. Three-node loop — Kirchhoff consistency (`ΣQ = 0`, `ΣΔp` around loop = 0).
6. EPANET Net1-style skeleton (hydraulics only) as a regression fixture.
7. Energy: prescribed `q` into a known `ṁ c_p` stream — `ΔT` exact.
8. If numbers can be read cleanly from MF13 / MF03 figures, add those as *approximate* regression targets, citing the paper, not as a claim of binary compatibility.

---

## 14. Sources

### Vendor pages

- https://inresllc.com/macroflow-overview.html
- https://inresllc.com/macroflow-for-electronics-cooling.html
- https://inresllc.com/macroflow-for-general-flow-systems.html
- https://inresllc.com/flow-network-modeling.html
- https://inresllc.com/macroflow-publications.html
- https://inresllc.com/products.html
- https://inresllc.com/about.html
- https://inresllc.com/
- https://inres.com/

### Papers (PDFs on the vendor site)

- https://inresllc.com/assets_site/files/macroflow/MF01-Elec-Cooling-Paper.pdf
- https://inresllc.com/assets_site/files/macroflow/MF02-Design-Methodology-for-Servers.pdf
- https://inresllc.com/assets_site/files/macroflow/MF03-Design_of_Liquid_Cooling_Systems.pdf
- https://inresllc.com/assets_site/files/macroflow/MF04-Microchannel_Heat_Sinks.pdf
- https://inresllc.com/assets_site/files/macroflow/MF05-Telecom-Shelf.pdf
- https://inresllc.com/assets_site/files/macroflow/MF06-server.pdf
- https://inresllc.com/assets_site/files/macroflow/MF07-Transceiver.pdf
- https://inresllc.com/assets_site/files/macroflow/MF08-Air-Cooled-Server.pdf (also at https://inres.com/assets/files/macroflow/MF08-Air-Cooled-Server.pdf)
- https://inresllc.com/assets_site/files/macroflow/MF09-Heat-Sink-Bypass.pdf
- https://inresllc.com/assets_site/files/macroflow/MF10-Burn-In_Oven.pdf
- https://inresllc.com/assets_site/files/macroflow/MF11-ATE-Liq-Cooling.pdf
- https://inresllc.com/assets_site/files/macroflow/MF12-RF-System.pdf
- https://inresllc.com/assets_site/files/macroflow/MF13-Design-process.pdf
- https://inresllc.com/assets_site/files/macroflow/MF14-FNM_CFD.pdf
- https://inresllc.com/assets_site/files/macroflow/MF15-Power-Supply.pdf

### Public technical references

- Belady, Kelkar, Patankar, "Improving productivity in electronic packaging with flow network modeling (FNM)," *Electronics Cooling*, Jan 1999. https://www.electronics-cooling.com/1999/01/improving-productivity-in-electronic-packaging-with-flow-network-modeling-fnm/
- Patankar, S.V., *Numerical Heat Transfer and Fluid Flow*, Hemisphere, 1980 (SIMPLE).
- Idelchik, I.E., *Handbook of Hydraulic Resistance*, CRC Press, 1994.
- Blevins, R.D., *Fluid Dynamics Handbook*, Krieger, 1992.

### Gaps (do not invent)

- Official *MacroFlow Users Manual* is cited everywhere and is **not** public.
- Native file extension / schema is **unpublished**.
- No official tutorial videos (do not confuse with diet-tracker "MacroFlow", Excel-macro tools, IES VE MacroFlo, or Autodesk Flow).
- No public price, license terms, or current supported OS newer than XP on the product pages.

---

## 15. Recommended next commit after this report

1. `schema/hydroflow.schema.json` — formalize section 11.
2. `packages/solver` — TypeScript SIMPLE prototype with the P0 acceptance test.
3. `apps/web` — Vite + React + XYFlow shell that loads / saves the JSON and calls the worker.
