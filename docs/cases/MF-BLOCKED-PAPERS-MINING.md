# Mining report: blocked / deferred / anchor papers

Mined 2026-09-07 from `/tmp/mf-papers/MF*.txt` and `/tmp/mf-papers/inventory.md`. **Authoritative status is `docs/cases/MF-PAPER-CASES.md`** — this file is the cited extract inventory for blockers. After mining, MF01/MF06/MF14 reconstructible slices were implemented on the paper-cases branch; table rows below may still say “deferred/anchors” as of the mine time.

**Rules used here:** every number is quoted or cited from those extracts. OCR-garbled cells are flagged. Figure-only bars are not treated as goldens. Engine features considered: `pipe`/`duct` Darcy, `K`, `rQuad`/`rLin`, `emitter`, `fan`/`pump` polynomial points, `tee`, energy `rTh`/`q`, `mdotSource`, `geometry.A`, `parallelCount`, `hex` UA coupling.

Paper-replay Q is a trend / inequality / historical band. Analytic P0 remains `tests/fixtures/goldens.json` (≤1% on Q).

| Paper | Board status | Hydro-flow case now? | One-line verdict |
|---|---|---|---|
| MF01 | deferred | pattern only (I8) | Table 2 fans are clean; Table 1 B is OCR-flagged; no tabulated Q/T |
| MF05 | blocked | no | Rich CFM/velocity tables; slot/fan-tray/filter K from unpublished meter tests |
| MF06 | deferred | **yes, historical band** | Published R as `rQuad` + imposed section Q; fan-intersection Q still needs vendor curves |
| MF10 | blocked | no | Table 1–2 Q/T exist; BIB impedance and DUT heat unpublished |
| MF14 | anchors only | topology yes, Q no | 65.8 vs 66.6 recorded; passage Δp(Q) and card L×W×H not in the extract |
| MF15 | blocked | no | Qualitative manifold trends; Fig 5–6/8–11 not tabulated; no hardware Q |
| MF03 R2 | partial (flow-only) | thermal no | Rth defined and plotted from Lytron Fig 5; no formula, no tabulated Rth(Q) |
| MF07 | blocked | no single-net subset | Two nets + HX handoff; Q/T figure-only; vendor A/fans unpublished |
| MF12 | blocked | no replay | **Yes, pure FNM numbers exist** (Table 1–2 FNM columns, 344/359, 383/397, 11.3 m/s); inputs unpublished |

---

## MF01 — Improved Productivity with Use of FNM in Electronic Packaging

**Board:** deferred (chassis B / fan tables OCR-unstable).

### 1. Reconstructible numeric targets

Cited from `MF01.txt` Example / Component Characteristics / Results (extract lines 219–302). No printed page numbers in the extract.

**Table 1 — “Flow characteristics and heat dissipation rates of individual components”** (lines 259–270). Header OCR: `Pa/(m /s) in ∆p=BQ` with split `3 2` / `2`. Inventory treats the law as `Δp = B Q²` with B in Pa/(m³/s)². Exponents for DASD / Processor / I/O sit on the following line.

| Component | B as printed | Heat (W) | OCR |
|---|---|---|---|
| DASD | `1.0x10` then `-4` | 2.5 | yes |
| Processor and Power Supply | `2.0x10` then `-5` | 150 | yes |
| Memory | `5.0x10-6` (inline) | 60 | no |
| I/O Cards | `1.0x10` then `-5` | 20 | yes |

`docs/VERIFICATION_CASES.md` R11: “HTML scrapes of those tables have disagreed with each other.” Do not promote Table 1 to a golden from this extract alone.

**Table 2 — “Maximum head and flow rate provided by the fans”** (lines 272–276). Clean.

| Fan | Maximum head | Maximum flow |
|---|---|---|
| Main Fan | 0.15 in of water | 66 SCFM |
| Power Supply Fan | 0.28 in of water | 74 SCFM |

**Other published numbers**

- Model construction “1.5 hours”; solve “10 seconds on a Pentium 133 PC” (Results, lines 298–300).
- Generic constitutive laws, not case-specific coefficients:
  - Eq. (1): `Δp = K · (1/2) ρ (Q/A)²` (lines 154–160).
  - Eq. (2): `Nu = A Re^m Pr^n` with A, m, n unnamed (lines 173–181).

**Not reconstructible as numbers**

- Fig. 5 volumetric flow and Fig. 6 bulk T: “The flow rates reported in Figure 5 pertain to one representative channel”; no table (lines 280–286, 291, 304).
- Screen / duct / expansion K: “available in handbooks” but not listed (lines 255–256).
- Expansion areas for Exp-1, Exp-2, Exp-CDTAP (lines 247–249).
- Ambient T, fluid density, inlet geometry.

**Topology that is in the prose** (Physical System + Network Representation, lines 225–252)

- Two fans.
- Inlet streams: DASDs, “gap between the DASDs”, “clearance above the Tape Drive and the CD-ROM” → Central Plenum.
- Main fan in the plenum forces flow through I/O and Memory/Processor card stacks.
- Power Supply Fan “draws some of the air through the Power Supply.”
- Area-expansion links Exp-1, Exp-2, Exp-CDTAP into the plenum.
- “a multiplier of four is applied to each of these components” (I/O and Processor/Memory card arrays).

### 2. Feasible now?

**Pattern only.** Engine can do two-point fans (`fan.coeffs` from Table 2 endpoints), `rQuad` if Table 1 B is accepted, `parallelCount: 4` (I8), and `q` for the Table 1 watts. There is no published branch Q or T to compare.

A side-by-side chassis replay is **not** feasible.

### 3. Exact blockers

1. No tabulated Q or T (Figs. 5–6 only).
2. Table 1 B OCR-flagged; R11 forbids inventing missing cells.
3. One Table 1 row lumps “Processor and Power Supply” (one B, one 150 W).
4. Handbook K and areas for inlet, screens, Exp-1/2/CDTAP unpublished.
5. Fan curves reduced to shutoff / free-delivery endpoints (same class of synthetic curve as MF08/MF13; not a catalog, but not a unique operating point either).
6. Eq. (2) has no A, m, n, so energy T cannot be computed from first principles.

### 4. Minimal example topology (plain English)

Ambient → three parallel inlet legs (DASD `rQuad`, DASD-gap, Tape/CD clearance) → expansion losses → central plenum → main fan (0.15 inH2O / 66 SCFM) → I/O + processor + memory legs with `parallelCount = 4`. A second path: ambient → power-supply resistance → PSU fan (0.28 inH2O / 74 SCFM) → ambient. Acceptance is I8 identity (one link ×4 vs four links), not Fig. 5 CFM.

---

## MF05 — Partial Recirculation Cooling Scheme for a Telecoms Shelf

**Board:** blocked (recirculation; sparse absolute Q). The extract is **not** sparse on Q. It is sparse on **constitutive data**.

### 1. Reconstructible numeric targets

Cited from `MF05.txt` System Design Objectives / Model Results / Design & Test Methods / Comparison (lines 87–350). No printed page numbers.

**Design objectives** (lines 96–99, 105–109)

- Target system power: 4000 W.
- Line-card slot velocity: 2.3 m/s; I/O slot: 2.5 m/s.
- Allowable air rise: 20 °C.
- NEBS envelope: 96 h at 50 °C; 1800 m; 20 µg/m³ dust; 60 dBA at 600 mm / 1500 mm.

**Table 2 — Bulk Flow Model Results** (lines 227–238)

| Location | Clean filter | Dirty filter |
|---|---|---|
| Fan inlet (Fig. 7 C) | 780 CFM | 750 CFM |
| Recirculation duct (Fig. 7 F) | 269 CFM | 301 CFM |

**Table 3 — Air Velocity Model Results** (lines 251–263)

| Slot | Clean | Dirty |
|---|---|---|
| Line Edge | 2.55 m/s | 2.47 m/s |
| Line | 2.49 m/s | 2.39 m/s |
| I/O Edge | 2.64 m/s | 2.94 m/s |
| I/O | 2.51 m/s | 2.80 m/s |

**Table 4 — Measured volumetric airflow** (lines 319–339), locations A–N on Fig. 7

A 462, B 678, C 734, D 194, E 201, F 216, G 399, H 56, I 351, J 189, K 7, L 15, M 23, N 40 CFM.

**Table 5 — Average velocities from bulk flow** (lines 285–297): B 2.5, C 2.7, D 2.5, E 2.6, F 2.8 m/s.

**HWA correlations** (lines 305–307): `cfm = v3 * 76.247`; `cfm = v4 * 90.372`.

**Table 6** (lines 328–338): fan inlet 780 vs 734 CFM (6%); recirculation 269 vs 216 CFM (24%, “power cables routed across the recirculation duct”).

**Table 7** (lines 340–349): line and I/O both 2.5 vs 2.6 m/s (4%).

**Energy (model off):** “the heat transfer option was turned off” (lines 209–212). Comparison text: theoretical rise “18 °C at designed maximum conditions” (lines 323–326).

**Constitutive form** (Table 1, lines 103–121): default resistances `ΔP = (1/2) k ρ V^n` from Idelchik; measured elements are obstruction-meter curves.

### 2. Feasible now?

**No** as a hydro-flow Q or velocity replay. Engine can represent a recirculation loop (mix node, tees, two exhausts, `mdotSource` unused if fans drive the loop) and a dirty-filter `rQuad` step, but every split in Tables 2–7 is set by unpublished meter curves.

### 3. Exact blockers

1. Fan-tray curve replaces the manufacturer fan curve after “metalwork proximity and flow turbulence” (lines 139–141); not tabulated.
2. Card-slot, louver, filter, and baffle resistances from full-size mockups on an Airflow Test Chamber (lines 133–137, 155–157); not tabulated.
3. Slot face area never given. Velocity = bulk Q / (width × depth − card area) (lines 268–275) with no width, depth, or card area.
4. Intake / exhaust baffle dimensions are design outputs, not inputs (lines 16–18).
5. Dirty-filter case is a “transient solve” with a “time dependent filter correlation” (lines 158–160, 220–223). Engine is steady-only (`analysis.type: "steady"`).
6. Recirculation 24% miss is blamed on unmodeled cable density (lines 308–310) — even the paper’s own model is not a closed reconstruction target.

### 4. Minimal example topology (plain English)

Ambient → intake baffle → filter → mix node (fresh + I/O return) → line-card slots (edge vs interior) → cooling-unit fan tray → split three ways: front exhaust, rear exhaust, recirculation up through I/O → back to the mix node. Leakage legs at faceplates (Table 4 H, K, L). Do not build this until fan-tray and slot `Δp(Q)` exist as user-imported curves. Not an R1–R11 case.

---

## MF06 — FNM: A Case Study in Expedient System Prototyping

**Board:** deferred (historical 10–18% hardware band; altitude density; not a 1% golden).

This is the only deferred/blocked paper whose **constitutive table is published**.

### 1. Reconstructible numeric targets

Cited from `MF06.txt` Ellison methodology / FNM Development / Tables 2–4 / FNM Verification (lines 59–457). No printed page numbers. Two figures are numbered 6 (network and system-curve plot).

**Law** (lines 111–113, 117–122)

- Turbulent: `ΔPSys = RSys QSys²` (Eq. 1).
- General: `ΔPSys = RSys QSys^N`, N ∈ [1, 2] (Eq. 2).
- Hardware in the transitional regime was `ΔP = R Q^1.5` vs Ellison `R Q²` (lines 438–439).

**Post-processed temperature, not an energy solve** (lines 88–94)

`ΔT [°C] = 1.76 P[W] / Q[ft³/min]` (Eq. 3). Design point: 5,000 ft and `350C` inlet (lines 370–375; OCR for 35 °C).

**Table 2 — CPU/Power R** in in H2O / CFM² (lines 280–312)

| Component | R | Notes |
|---|---|---|
| Front Bezel | 1.84×10⁻⁷ | perforated plate, 50% open; formula `2.4×10⁻³ / A²[in²]` |
| Inlet Vent | 1.28×10⁻⁷ | 60% open; same formula |
| CPU Board (Top) | 5.52×10⁻⁵ | lumped |
| CPU Heat sink | 1.17×10⁻³ | extruded; turbulent |
| 15° Turn | 2.00×10⁻⁵ | contraction |
| Chip Heat sink | 2.32×10⁻³ | extruded; turbulent |
| CPU Board (Bottom) | 1.02×10⁻⁴ | lumped |
| VRM / expansion | “Various” | formulas given, no number |
| System Board | 4.70×10⁻⁴ | lumped |
| System-board chip HS | 3.12×10⁻³ | extruded; turbulent |
| Core IO Board | NA | “Negligible (No Heat sinks)” |
| Exit Vent | 1.41×10⁻⁷ | 60% open |
| Fan Modules | 8.98×10⁻⁸ | 75% open |
| Power Supply Inlet Vent | 4.63×10⁻⁵ | 60% open |
| Power Supply | 4.30×10⁻⁵ | card cage, 50% open, 1" pitch |
| **Section total** | **1.31×10⁻⁶** | Table 1 series/parallel rules |

**Table 3 — PCI/Memory R** (lines 344–362)

| Component | R | Notes |
|---|---|---|
| Front Bezel | 3.13×10⁻⁶ | 50% open |
| Inlet Vent | 4.78×10⁻⁷ | 60% open |
| Memory Module | 1.80×10⁻⁵ | **measurement**, past product |
| Mass Storage Bay | 3.3×10⁻⁵ | **measurement**, past product |
| Memory “U” Wall | 1.08×10⁻⁶ | 50% open |
| Fan Modules | NA | “Negligible (finger guards only)” |
| PCI Card Cage | 1.67×10⁻⁶ | card-cage formula, “modified by 1.5 to match data” |
| Exit Vent | 5.74×10⁻⁷ | 60% open |
| 90° Turn | 4.71×10⁻⁷ | sharp corner |
| **Section total** | **6.67×10⁻⁶** | |

Open areas as percentages are published; absolute A (in²) is not, except that A can be inverted from `R = 2.4×10⁻³ / A²` for the perforated plates that use that formula. That inversion is a unit-consistent reading of two published numbers, not a new measurement.

**Table 4 — Flow Rate Estimate Comparison** (lines 444–457)

| Component | Ellison CFM | MacroFlow CFM | Exp CFM |
|---|---|---|---|
| CPU/Power Section | 338 | 398 | 398 |
| CPU Heatsink | 5 | 6 | — |
| System Board | 14 | 16.8 | — |
| System Board Heatsink | 4.6 | 5.5 | — |
| Power Supply | 31 | 26 | — |
| PCI/Memory Section | 158 | 163 | 180 |
| Mass Storage | 38 | 27 | — |
| Memory Carrier PCB | 30 | 34 | — |
| PCI Card | 9.6 | 10.2 | — |

Ellison vs MacroFlow on the two section totals: 17.8% and 3.2%. Ellison vs experiment: 17.8% and 13.9%. Prose: measured system curves “within 14-18%” of Ellison (lines 429–431). Sub-system Ellison vs MacroFlow “3-29%”; worst cell mass-storage vs memory (lines 432–439).

**Metrology** (lines 421–424): ±0.005 in H2O static; 29 CFM volumetric (“± 0.02 in H20 for a 3 inch nozzle”).

**Altitude note** (lines 368–370): “volumetric flow rates of air through identified flow paths remain constant with increasing altitude” (tube-axial, constant speed). Density still enters `ΔP = R Q²` and Eq. 3 if R was computed at sea level.

**Not tabulated:** manufacturer fan curves (series/parallel aggregate, lines 364–378); Fig. 6 system-curve plot (0–0.30 in H2O vs 0–600 CFM axes only).

### 2. Feasible now?

**Yes, as a historical-band example, not a 1% golden.**

`rQuad` is exactly Ellison Eq. 1 after converting in H2O/CFM² → Pa/(m³/s)². `mdotSource` (or a fixed-Q boundary pair) can impose the Table 4 **section** totals. `rho` as a fluid input covers U15 / 5000 ft. Tees are unnecessary: the paper’s two compartments “do not mix” (lines 140–143).

Fan-intersection operating points (338 / 398 and 158 / 163 / 180) are **not** feasible without vendor fan curves.

Hydro-flow `rQuad` (n = 2) is the Ellison column, not the MacroFlow column. MacroFlow “does not require an upfront estimate of the system flow regime” and accepted transitional `n = 1.5` data (lines 420–439).

### 3. Exact blockers (for a 1% or fan-operating-point replay)

1. Fan curves unpublished (N+1 parallel exhaust on CPU/Power; two series columns on PCI/Memory; intermediate-fan discharge loss on PCI).
2. Table 4 does not say whether “Power Supply 31”, “Memory Carrier PCB 30”, or “PCI Card 9.6” are per unit or path totals. Six PS paths and four memory modules are drawn (Figs. 5–6).
3. VRM / sudden-expansion R = “Various”; use the lumped CPU-bottom R = 1.02×10⁻⁴ rather than inventing the internals.
4. PCI cage R already includes a 1.5× data fit (line 353).
5. Hardware band is 10–18% by publication claim (`VERIFICATION_CASES.md` §1, §9).

### 4. Minimal example topology (plain English)

Two **independent** networks (no shared nodes).

**CPU/Power:** ambient → bezel `rQuad` 1.84e-7 → inlet vent 1.28e-7 → parallel of (CPU-top 5.52e-5 including HS/turn/chip-HS, CPU-bottom 1.02e-4, system board 4.70e-4 including chip HS, six copies of PS inlet 4.63e-5 + PS 4.30e-5) → exit vent 1.41e-7 → fan-module plate 8.98e-8 → ambient. Impose 338 CFM (Ellison) or 398 CFM (MacroFlow / exp). Compare branch splits to Table 4 Ellison if Q = 338.

**PCI/Memory:** ambient → bezel 3.13e-6 → inlet 4.78e-7 → parallel of (mass storage 3.3e-5, four memory 1.80e-5, PCI cage 1.67e-6) → U-wall 1.08e-6 → 90° 4.71e-7 → exit 5.74e-7 → ambient. Impose 158 CFM (Ellison) or 163 / 180.

Do not fit `rQuad` to 398/180. Convert published R. Leave fans out until a user imports curves.

---

## MF10 — Design of a Burn-In Oven

**Board:** blocked (sparse numeric extract). The extract is **not** sparse on Q/T. It is sparse on BIB impedance and heat.

### 1. Reconstructible numeric targets

Cited from `MF10.txt` Application / Physical System / Network / Results. Printed pages 3–6 in the extract.

**Blower** (p. 4, lines 187–188): “maximum head of 3 inches of water and its maximum flow capacity is 6000 CFM.”

**Fig. 1 overall dimensions** (p. 3, lines 104–131): zone stack callouts 14", 44", 20"; plan 23.25", 5.5", 20.25", 23.25"; two sections of three zones separated by a heat sink; airflow toward a blower.

**Fig. 2 BIB schematic** (p. 3, lines 155–174): 12", 18", 18", 1.25" callouts; “cards were numbered 1 through 12 in a zone” (p. 5, lines 201–202).

**Table 1 — measured vs calculated CFM** (p. 5, lines 205–216)

| Zone | Card 1 meas/calc | Card 6 meas/calc | Card 12 meas/calc |
|---|---|---|---|
| 1 | 1000 / 981 | 1200 / 1198 | 1650 / 1585 |
| 3 | 1650 / 1689 | 1700 / 1689 | 1550 / 1534 |
| 4 | 1100 / 1268 | 1850 / 1880 | 1750 / 1811 |
| 6 | 1050 / 983 | 1400 / 1411 | 1600 / 1578 |

**Table 2 — °C** (p. 5, lines 221–231)

| Zone | Card 1 meas/calc | Card 6 meas/calc | Card 12 meas/calc |
|---|---|---|---|
| 1 | 83 / 81 | 82 / 81 | 79 / 80 |
| 3 | 78 / 79 | 79 / 79 | 75 / 77 |
| 4 | 84 / 88 | 84 / 89 | 83 / 81 |
| 6 | 84 / 88 | 83 / 88 | 80 / 82 |

**Other:** “over 500 flow components” (p. 6, line 245); network build 2.5 man hours; solve < 15 minutes on a Pentium 133 (p. 6, lines 246–247); fourteen designs in five days (p. 6, line 255).

**Energy:** on. “average temperature across the BIB” (p. 5, lines 198–200). Passives neglected (p. 3, lines 136–137).

### 2. Feasible now?

**No** as a Table 1 / Table 2 replay. Engine can do a closed-loop blower (2-point curve), six zone headers, and `tee` laterals. It cannot recover those CFM/°C values without the measured BIB `Δp(Q)` and DUT heat.

### 3. Exact blockers

1. “The flow impedence of the passage between the two adjacent BIBs is experimentally characterized and used in the analysis” (p. 4, lines 186–187) — curve not published.
2. DUT heat unpublished. Table 2 cannot be replayed with energy `q` / `rTh`.
3. Zones 2 and 5 omitted from both tables.
4. Fig. 1–2 give envelope and pitch-like callouts, not passage hydraulic diameter or clear area.
5. Blower is two endpoints, not a curve.
6. Fitting BIB `rQuad` to Table 1 is the same class of forbidden move as a lumped fit to MF14 65.8 CFM.

### 4. Minimal example topology (plain English)

Closed loop: blower → split into two sections of three zones → each zone a 12-slot header (bottom-to-top, tees) → collect → inter-section heat sink → blower. Screens / expansions / contractions as handbook links if areas are later measured. Until BIB `Δp(Q)` and DUT watts exist as user data, this is an I2-shaped pattern only (not in R1–R11).

---

## MF14 — Coupling FNM and CFD on an Electronics Enclosure

**Board:** anchors only (`tests/fixtures/paper/mf14-totals.json`). Question: what topology / geometry **can** be reconstructed without catalogs?

### 1. Reconstructible numeric targets

Cited from `MF14.txt` §§II–VI (extract lines 56–230). No printed page numbers.

**Hardware (published)**

- “thirteen PCBs are evenly arranged with a 0.8 inches separation” (lines 117–118).
- “All PCBs except for PCB 3 have a nearly identical component configuration” (lines 119–120).
- “four heat sinks mounted on PCB 3” (line 57).
- “approximately 24 Watts of power each, totaling 300 Watts” (lines 58–59). Energy **off** in the published solve: “a calculation of the temperature distribution is not attempted” (lines 130–132).
- Inlet: “in front of and below the cards”, “17 degree ramp”, then EMI shield (lines 59–61).
- EMI: “open area of 51% and an orifice diameter of 0.31 inches” (lines 73–75).
- Two axial fans above the PCBs: “maximum head of 0.24”of water and maximum flow rate of 45 CFM” each (lines 181–184).
- Exit: 90° turn, second EMI, rectangular duct, rearward (lines 62–63, 176–178).
- Bypass: “between the last card surface and the corresponding wall of the cabinet” (lines 169–171).
- Installation context: modular array; exit aimed so exhaust is not ingested (lines 63–68).

**Q anchors**

- Measured inlet **66.6 CFM ± 0.5** (lines 180–181).
- FNM **65.8 CFM** (line 182).
- Card-passage flows “within 10%” of measurement (lines 50, 182–185, 268). Fig. 5 bars **not tabulated**.
- Qualitative Fig. 5: Passage 1 highest (sidewall, no obstructions, largest area); Passage 4 reduced (heat sinks on PCB 3); center passages “fairly constant” (lines 217–228).

**Taper claim:** “such a taper is necessary only when the screen resistance is small (percentage open area >80%)” (lines 228–230).

**Fig. 3** (lines 301–317): CFD impedance, PCB with / without heat sink. Axes 0–0.25 in H2O vs 0–10 CFM. **Points not tabulated.**

**Already recorded:** `tests/fixtures/paper/mf14-totals.json` (`Hmax_inH2O: 0.24`, `Qmax_CFM: 45`, `count: 2`, FNM 65.8, test 66.6 ± 0.5).

### 2. Feasible now?

**Topology: yes. Numeric FNM total: no.**

Engine already has everything the *network sketch* needs: inlet `K` + `geometry.A`, rectangular passages (`geometry.A` + `D` as Dh), bypass duct, two 2-point fans, optional `tee` at the collector. Missing are the numbers that fix 65.8 CFM.

A lumped `rQuad` fit to 65.8 is already rejected on the status board.

### 3. Exact blockers

1. Fig. 3 passage `Δp(Q)` not tabulated (the CFD product the FNM actually used).
2. Card height, card depth (into the page), card thickness, cabinet width/height, inlet face area, exit duct size: **not in the extract**. Fig. 1 is a rendering without a scale table.
3. Full manufacturer fan curve unpublished; only the two max points.
4. Fig. 5 branch CFM unpublished, so even a reconstructed total cannot be checked passage-by-passage.
5. Heat-sink internal geometry unpublished (paper used a separate FNM of the extrusion, then a porous CFD volume — lines 156–169).
6. Inventing depth / height / thickness (for example 8 in × 6 in × 30% of pitch) is not reconstruction.

### 4. What **can** be reconstructed without catalogs

Plain-English topology that stays inside the extract:

Ambient → inlet opening (handbook inlet) → 17° ramp plenum → EMI screen (51% OA, 0.31 in holes; Idelchik/Blevins **form**, face area unknown) → parallel of:

- Passage 1: chassis sidewall to back of PCB 1 (largest, empty),
- Passages 2, 4–12: nominally identical “no heat sink” cards (0.8 in pitch),
- Passage 4 in the paper’s numbering: PCB 3 with four heat sinks (higher R),
- End-wall bypass: last card to cabinet wall, rectangular duct + bottom screen,

then two fans in parallel (0.24 inH2O / 45 CFM endpoints) → 90° turn → exit EMI → ambient.

**Recommended minimal example:** keep the fixture (`mf14-totals.json`) as the historical anchor. If a project file is added, it must label assumed L, depth, and thickness as **non-paper** and must not tune `rQuad` to 65.8. Acceptance stays “FNM vs test 65.8 vs 66.6 is a historical data point” (R8), plus optional inequalities: Q_pass1 > typical center; Q_heatsink_passage < typical center.

---

## MF15 — Flow Distribution in a Power Supply

**Board:** blocked (power-supply internals; sparse tabulated Q).

### 1. Reconstructible numeric targets

Cited from `MF15.txt` Physical System / Network Model / Results (lines 66–235). No printed page numbers.

**Published scalars**

- “twenty boards” / “20 identical boards” / “20 identical flow passages” (lines 71–73, 79).
- “four fans placed in front of the heat sinks” per passage (lines 73–74, 160–161).
- Cabinet “20×12×65 inches” (line 80).
- “total power dissipation is approximately 6 kW” (lines 80–81).
- Installed “about 2 inches away from the wall” (line 81).
- Energy off: “prediction of the temperature field is not attempted” (lines 188–190).
- Build time: passage model “less than 2 hours”; system solve “less than a minute” (lines 199–201).

**Qualitative Q (not numbers)**

- Isolated cabinet (Case A): side vents; “all passages have about the same amount of flow rate for the forward stream”; “a large portion of the flow … leaves through the side vents” (lines 206–213).
- Two cabinets (Case B): “forward flow increases and the reverse flow decreases from the bottom to the top” (lines 219–222).
- Many cabinets (Case C): no side vents; “the forward flow is smallest and the reverse flow is highest at the bottom because the back pressure is the highest at the bottom” (lines 225–231).
- Fig. 11: heat-sink flows in “the 15th passage (out of 20) for an isolated cabinet” (line 335) — figure only.
- “Detailed measurements have not been performed” (lines 234–235).

**Figs. 5–6 axes only** (lines 273–300): pumping characteristic 0–0.6 in H2O vs 0–50 CFM; reverse resistance 0–0.6 in H2O vs 0–12 CFM. **Points not tabulated.**

**Passage internals (topology, no sizes)** (lines 157–173)

- Fan 1 in-line with Heat Sink 1 (horizontal base) — “no bypass”.
- Heat sinks 2, 3, 4 vertical bases — bypass around each.
- Volume between HS 3 and 4 allows forward or reverse flow.
- Screens before the rear header; header treated as a specified-pressure node when characterizing one passage.

### 2. Feasible now?

**No** as a Q replay. Engine can express the two-level idea (I6): solve one passage, tabulate `Δp(Q)`, reuse as `fan.coeffs` (forward / pumping) plus `rQuad` (reverse / resistive), then stack 20 copies with `tee` combining in the rear header. Inputs for those curves are unpublished.

### 3. Exact blockers

1. No tabulated Q anywhere (Figs. 8–11 only).
2. Fig. 5–6 compact characteristics not digitized in the extract.
3. Fan curves, heat-sink geometry, screen FA, board pitch, and passage height unpublished (Fig. 1 is a schematic).
4. No hardware Q (“detailed measurements have not been performed”).
5. 6 kW and 20×12×65 in do not determine a flow split.

### 4. Minimal example topology (plain English)

**Level 1 (one passage):** ambient → four fans → (HS1 with no bypass) ∥ (HS2+bypass) ∥ (HS3+bypass) ∥ (HS4+bypass) → screens → rear node; plus reverse openings between the fans back to ambient.

**Level 2 (rack):** 20 parallel compact modules, each a pumping forward leg plus a resistive reverse leg; forward legs combine in a vertical rear header (tees) and exit at the top; Case A adds side vents to ambient, Case C removes them.

Acceptance if ever built: inequalities only — isolated ≈ uniform forward Q; sealed stack → Q_forward,bottom < Q_forward,top. Not a 1% golden. I6 pattern, not R1–R11.

---

## MF03 R2 — five-plate loop thermal (any Rth formula without Lytron?)

**Board:** partial (flow-only). Existing files: `examples/mf03-orifice-balance-tuned.hydroflow.json`, `src/engine/examples/mf03OrificeBalance.ts` (energy off).

### 1. Reconstructible numeric targets

Cited from `MF03.txt` “Design of a Water-Cooled System”, printed pages 3–5.

**Loads and SKUs — Table 1** (p. 5, lines 218–226)

| EU | Heat (kW) | Cold plate |
|---|---|---|
| EU-1 | 0.3 | CP-10 6" 2 Pass |
| EU-2 | 0.4 | CP-10 6" 2 Pass |
| EU-3 | 0.5 | CP-10 6" 2 Pass |
| EU-4 | 3.0 | CP-10 12" 4 Pass |
| EU-5 | 4.0 | CP-10 12" 4 Pass |

**Loop BCs** (p. 5, lines 222–224): “desired flow rate of 6.8 gpm at a temperature of 25oC at the exit of the heat exchanger.”

**Thermal target** (p. 5, lines 213–214, 232–241): keep “average temperature of the surface of each cold plate below 60oC”. Identical orifices: “Units 1 and 2 are cooled excessively while Units 3 and 4 are operating well beyond” 60 °C. Revised orifices: each plate “below the maximum allowable temperature.” Fig. 6 bars **not tabulated**.

**Rth in the paper** (p. 2, lines 102–107), quoted:

> “The thermal performance of a cold plate or a heat sink is characterized in terms of the variation of thermal resistance with the flow rate. Thermal resistance, in turn, is defined as the difference between the temperature of the electronic component and the inlet coolant temperature required to transfer one unit of power.”

Fig. 5 (p. 4, lines 186–197) is “Flow and thermal resistance characteristics of the Lytron cold plates [5]” — CP-10 6" double pass and CP-10 12" quadruple pass — **catalog plots, no table**.

Reference [5] is “Lytron - Total Thermal Solutions, 2003 Product Catalog” (p. 6, lines 271–273). Product fence: do not scrape it.

**No other thermal formula** in MF03: no Nu, no h, no channel count / Dh / k for CP-10, no tabulated Rth(Q). Generic FNM energy is “heat loss/gain in each link” + nodal energy balance (p. 2, lines 141–143). Orifice K “from the ratio of the minimum and the inlet/exit areas” (p. 2, lines 99–100) — areas unpublished.

### 2. Feasible now?

**Flow-only: already landed.** Thermal R2 (every Ts < 60 °C): **no**, not without inventing `rTh` or scraping Lytron.

Engine energy is `T_surface = T_mean + q * rTh` with **constant** `rTh` (`src/engine/solve.ts`). MF03’s Rth is **Rth(Q)** referenced to **inlet** T, not mean fluid T. Those are different definitions.

MF04 could back-calculate constant `rTh` because it published unbalanced Tb (33.1 / 42.3 / 49.8 °C). MF03 did not publish the Fig. 6 temperatures — only the 60 °C inequality.

### 3. Exact blockers

1. No Rth formula and no tabulated Rth(Q) in the extract.
2. Fig. 5 is a vendor catalog plot ([5]); scraping is out of scope.
3. No CP-10 internal geometry for a handbook Nu.
4. Pump, HX, filter, main/branch orifice diameters unpublished.
5. Fig. 6 Ts not tabulated, so a guessed constant `rTh` cannot be checked except against a binary “over / under 60 °C”.
6. Engine `rTh` is not Rth(Q) and is not inlet-referenced.

### 4. Minimal example topology (plain English)

Already sketched in the flow-only example: reservoir / HX exit at 25 °C → pump → filter → main orifice → U-manifold → five branches (orifice + cold plate) with loads 0.3 / 0.4 / 0.5 / 3.0 / 4.0 kW → return. Keep energy off until a **user-imported** Rth(Q) table exists. Do not invent a constant `rTh` to force Ts < 60 °C.

---

## MF07 — Thermal Design of a Base Transceiver Station

**Board:** blocked (dual-network + HX handoff = P3+ product). Question: any **single-network** subset reconstructible without the dual-net product?

### 1. Reconstructible numeric targets

Cited from `MF07.txt` Physical System / Conceptual Design / Flow Network Modeling (lines 49–215). No printed page numbers. Fig. 5 caption is duplicated; Fig. 6 is missing in the extract.

**Published scalars**

- Internal dissipation “1.7 kilowatts” (lines 55–56).
- Ambient “+52 o C” plus “maximum solar heat load” (lines 57–60).
- Solar from Bellcore GR-487-Core (lines 137–139, 237–238); **wattage not computed in the extract**.
- CFD-grid remark: cabinet “40 inches” vs heat-sink / HX channel “0.018 inch” (lines 198–200). That pair is a mesh argument, not an FNM bill of materials.
- Law: `p = AQ²` (Eq. 1, lines 122–126). “The coefficient A was calculated based on correlations and data provided in [1] and [2]” (Idelchik 1994, Ellison 1989). **A is not tabulated.**
- ATM switch and rectifier `Δp(Q)`: “obtained from vendor’s data” (lines 128–129).
- “Vendor provided fan curves” (lines 129–131).
- Hardware list: PCB rack “seventeen PCBs and two PCU boards”, RF amplifier, two RF filters, ATM switch, rectifier (lines 50–54).
- Two MacroFlow models: “one for the external airflow path and the other one for the internal airflow” (lines 57–58).
- HX handoff: “the total heat dissipation for devices in the internal airflow section was input to the heat exchanger in the external airflow model. The calculated heat transfer coefficient and average air temperature within the external airflow channel of the heat exchanger were then input to the internal airflow model as boundary conditions” (lines 149–156).

**Q / T:** Figs. 5, 7, 8 only (lines 159–167, 182–184, 221–226). No table.

### 2. Feasible now?

**No single-network subset has enough numbers to replay.**

The engine already has `hex` UA coupling (`couplings[]`, `hex-stream`) and can put two air paths in **one** `Project`. The status-board “P3+ product” note is about a two-graph UI / BC handoff, not a missing constitutive type. That does not create a reconstructible case: UA, A, fan curves, and Q/T remain unpublished.

External-only (blowers → amp heat sink → HX core → cabinet-wall channels, solar on the inlet-side “shinny surface”, shade on exhaust — lines 137–139, 161–162) still needs A, fan curves, solar W, and a Q target.

Internal-only (fans → PCBs / ATM / rectifier / filters + perforated baffles — lines 164–171) still needs vendor `Δp(Q)` and A.

### 3. Exact blockers

1. No tabulated Q or T.
2. Coefficient A unpublished.
3. Fan curves unpublished.
4. ATM / rectifier impedance unpublished.
5. Solar watts unpublished (standard cited, not evaluated).
6. HX UA / h / area unpublished (handoff is h and T, not a published UA).
7. 40 in / 0.018 in is not a network geometry list.

### 4. Minimal example topology (plain English)

**Do not build a Q case.** If a pattern file is wanted later: one project with an external blower loop and an internal fan loop sharing a `hex` coupling; solar as `q` on the inlet-side external wall channels only. Acceptance is “two loops + hex converge,” not Fig. 5 CFM. R9 stays P3+ as a product workflow.

---

## MF12 — Rapid Scale-Up Design of an RF Absorption Load (FNM + CFD)

**Board:** blocked (FNM+CFD workflow; not an FNM Q golden). Question: any **pure FNM** numeric claim?

### 1. Reconstructible numeric targets (including pure FNM)

Cited from `MF12.txt` printed pages 4–9. Yes — several FNM-only numbers exist. They are **outputs** of an unpublished input deck.

**Design goals** (p. 4, lines 220–232)

- 25 kW average, 10 dB peak; reuse 10 kW RF section.
- “1500 total CFM at 60 Hz. line frequency”.
- “Average velocity greater than 10 m/sec at the start of the absorption array”.
- “Average resistor temperatures less than 500 degrees C”.
- Ambient margin +45 °C and 50 Hz; package smaller than 30L × 30W × 60H in.

**Pure FNM claims (not CFD)**

First-pass scale-up, 25 kW AMDs in the **10 kW geometry** (p. 7, lines 441–444):

> “The FNM model predicted 344 and 359 CFM for each of the 50 and 60 Hz AMDs respectively, which translates to the overall CFMs of 1375 and 1436 through the system.”

Final geometry (p. 8, lines 530–534):

> “The predicted volumetric flow rates are 383 and 397 CFM for each of the 50 and 60 Hz AMDs respectively, which translates to the overall CFM of 1532 and 1588 through the system.”

Launch velocity (p. 8, lines 452–454):

> “FNM predicts an average velocity of 11.3 m/s in the RESISTOR_LAUNCH section for the final 25kW design.”

**Table 1 — one AMD, FNM column** (p. 8, lines 593–610). Total = 4 × AMD (multiplier 4, p. 5, lines 266–270).

| Case | FNM CFM | CFD | Exp |
|---|---|---|---|
| 10 kW 50 Hz | 217 | 233 | 244 |
| 10 kW 60 Hz | 227 | 249 | 250 |
| 25 kW 50 Hz | 383 | 395 | 399 |
| 25 kW 60 Hz | 397 | 410 | 414 |

Prose: FNM vs measured “within 11%”; CFD “within 5%”; FNM vs CFD “always below 10%” (p. 8, lines 522–528).

**Table 2 — average resistor surface °C, FNM column** (p. 8, lines 561–597)

| Case | FNM | CFD | Exp |
|---|---|---|---|
| 10 kW 50 Hz, 45 °C ambient | 310 | 302 | 271 |
| 10 kW 60 Hz, 25 °C | 248 | 238 | 245 |
| 25 kW 50 Hz, 45 °C | 425 | 413 | 390 |
| 25 kW 60 Hz, 25 °C | 388 | 376 | 351 |

FNM energy: “available empirical correlations”; conduction and radiation “ignored”; CFD says those modes “contribute less than one percent” (p. 8, lines 613–625). Conclusion: FNM T “with 14% of experimental”, CFD 11% (p. 9, lines 644–646).

**Relative geometry (no baseline lengths)** (p. 8, lines 515–526)

- RF inlet screen “fractional clear area of almost 50%” (p. 5, line 294).
- Baseline exhaust FA 0.63; manufacturing cap 0.65; kept 0.63 (lines 517–522).
- Exhaust duct area (DUCT02) “increased by 28%”; orifice size “increased by 66%”; OAGs “scaled up 50%”; exhaust Δp “reduced … by 29%”.
- Final envelope “27”L x 27”W x 60”H” (line 525).

**Test notes** (p. 7, lines 375–390): 25 °C ambient; OAG static pressure → manufacturer curve; ±15 CFM; resistor T by non-contact, ±35 °C.

**Generic FNM laws** (p. 5, lines 279–294): Eq. (5) `Δp = (1/2) k ρ (Q/A)²`; Eq. (6) `Nu = a Re^m Pr^n` with a, m, n unnamed.

### 2. Feasible now?

**No replay.** The FNM numbers are real and citable. The deck that produced them (AMD manufacturer curves, OAG / RF-housing / duct areas, screen hole geometry, resistor area for energy) is not in the extract.

`parallelCount: 4` is the I8 pattern already required elsewhere. Relative +50% / +28% / +66% needs a numeric baseline the paper does not give.

### 3. Exact blockers

1. AMD curves unpublished (“data provided by the manufacturer”, p. 5, lines 277–278).
2. Absolute areas / Dh / lengths for AIR_INLET, OAG, RF_INNER_HOUSING, DUCT01/02, RESISTOR_LAUNCH unpublished.
3. Screen hole geometry unpublished (only FA ≈ 50% and exhaust FA 0.63).
4. Eq. (6) coefficients unpublished, so Table 2 FNM T cannot be rebuilt.
5. Digitizing Fig. 5–7 (system curve, Δp breakdown, velocities) is not in this extract.

### 4. Minimal example topology (plain English)

Do not build a Q golden. Pattern only: ambient → inlet → AMD → area expansion → OAG duct → 90° → RF screen (~50% FA) → 90° → resistor launch → four identical branches merge (`parallelCount = 4` up to the merge) → RF inner housing duct → exhaust duct → exhaust screen (FA 0.63) → ambient. Acceptance if ever rebuilt from **user** AMD + area tables: FNM AMD Q within the paper’s 11% band of Table 1 experiment — still not a 1% golden.

---

## Cross-cutting engine notes

Features that **do not** unlock these papers by themselves:

| Feature | Helps | Does not replace |
|---|---|---|
| `rQuad` | MF06 published R; MF01 Table 1 **if** OCR is accepted | MF05/10/15 meter or catalog curves |
| 2-point `fan.coeffs` | MF01 Table 2, MF10 3 in / 6000 CFM, MF14 0.24 in / 45 CFM | Full vendor maps for operating-point Q |
| `geometry.A` + Dh | Rectangular slots once L×W exist | MF14/MF05/MF12 unpublished faces |
| `tee` | MF10 zone headers; MF15 rear combining; MF14 collector | Unpublished junction geometry |
| `rTh` / `q` | MF04-style **tabulated** T | MF03 R2 (no Rth(Q)); MF10 (no DUT q) |
| `mdotSource` | MF06 imposed section totals; MF03 6.8 gpm (already used) | MF05/12/14 fan-intersection cases |
| `hex` UA | MF07 pattern in one project | Dual-graph product; unpublished UA |
| `parallelCount` | MF01 ×4; MF12 ×4 | Missing branch K |
| `emitter` | unused in these extracts | — |

## What to implement next (if anything)

1. **MF06 Ellison R-network with imposed section Q** — only reconstructible hydro-flow case in this set. Historical band, not P0. Convert published R; do not invent fans.
2. **MF01 I8 multiplicity** — Table 2 endpoints + `parallelCount = 4`; no Fig. 5 Q.
3. Leave MF05, MF07, MF10, MF12, MF15, MF03 R2 thermal, and MF14 total-Q as documented blockers / anchors.

Untracked drafts `src/engine/examples/mf01Multiplicity.ts`, `mf06AltitudeDensity.ts`, and `mf14Enclosure.ts` (workspace leftovers) invent placeholder K, synthetic mid-curve fans, and card depth/height. They are **not** reconstructions and should not be committed as paper cases.
