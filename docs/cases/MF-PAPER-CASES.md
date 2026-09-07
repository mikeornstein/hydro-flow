# MacroFlow paper-case replays (§7)

Inventory and side-by-side status for publication cases listed in `docs/MACROFLOW_RESEARCH.md` §7.

## Policy

- Analytic P0 goldens stay ≤1% on Q.
- Paper replays compare to digitized figures or published tables.
- Digitization uncertainty is recorded in `tests/fixtures/paper/*-digitized.json`.
- Do not special-case the solver to match a bar chart. Close gaps with handbook physics (tees, rectangular `A`+`Dh`) or document the remaining discrepancy here.

## Status (MF01–MF15)

| Paper | Status | Evidence | Notes |
|---|---|---|---|
| MF01 | partial (multiplicity) | `examples/mf01-multiplicity-chassis.hydroflow.json`, `out/mf01-multiplicity-comparison.tsv`, `mf01-table1.json`, `mf01-blocker.json` | Table 2 fans clean; `parallelCount=4` matches expanded 4 links ≤1%. OCR Table 1 B decades recorded but rejected as SI rQuad (ΔP ≪ fan head). No invented exponents. |
| MF02 | none | `mf02-blocker.json` | Methodology / process paper; no reconstructible network. |
| MF03 R1 | implemented | `examples/mf03-cold-plate-header-*.hydroflow.json`, `tests/mf03Header.test.ts`, `out/mf03-fig3-comparison.tsv` | Friction 12.7% / Idelchik 21.7% / Gardel 10.4% max rel on 7/16" vs Fig 3. Gardel overshoots max/min (2.61 vs 2.12). See MF03 tee section. |
| MF03 R2 | partial (flow + fixed-rTh energy) | `examples/mf03-orifice-balance-*.hydroflow.json`, `out/mf03-orifice-comparison.tsv`, `out/mf03-orifice-energy.tsv` | Tuned orifices raise high-load share; fixed rTh energy shows identical max T&gt;60 °C and tuned ≤60 °C. Not Lytron Rth(Q). |
| MF04 | partial | `examples/mf04-orifice-balanced.hydroflow.json`, `out/mf04-orifice-energy.tsv`, `mf04-blocker.json` | fRe 57/62, loads 70/120/200 W, unbalanced bases 33.1/42.3/49.8 °C from PDF. Orifice rebalance + energy `rTh`/`q` implemented; manifold channel count / Nu / inlet T sparse → absolute T not a 1% golden. |
| MF05 | blocked | `mf05-blocker.json` | Recirculation targets exist; absolute CFM / fan curves unpublished. |
| MF06 | partial (published R + density) | `examples/mf06-altitude-*.hydroflow.json`, `out/mf06-density-comparison.tsv`, `mf06-table4.json` | Tables 2–3 section R as SI rQuad; synthetic fans pin sea-level to MacroFlow Table 4 within 2%. Density scales rQuad → higher CFM at 5000 ft. Historical 14–18% band retained. |
| MF07 | blocked | `mf07-blocker.json` | Dual-network + HX handoff is P3+ product work. |
| MF08 | partial | `examples/mf08-server-fan-caseB.hydroflow.json`, `out/mf08-fan-impedance.tsv`, `mf08-table1.json` | Synthetic fan from goals + chassis/PCI/exhaust. Case B: proc avg 1.3% / total 10.6% vs Table 1; A→B→C processor direction holds. Not a vendor catalog. |
| MF09 | implemented | `examples/mf09-heat-sink-bypass.hydroflow.json`, `out/mf09-fig4-comparison.tsv` | Monotonic sink-fraction decline. Mid-curve abs err ≤~0.25 vs digitized Fig 4. |
| MF10 | blocked | `mf10-blocker.json` | Burn-in oven; experimental BIB impedance / DUT heat unpublished. |
| MF11 | implemented (pattern + Table 1 LCM) | `examples/mf11-lcm-table1.hydroflow.json`, `out/mf11-table1-hierarchy.tsv`, `mf11-table1.json` | LCM golden pinned at 0.12 gpm @ 3.50 psig. Hierarchy 1 / 28 / 113 parallel LCMs; row/system within ~2% of Table 1 Q at LCM ΔP. Hardware 10% band is the publication claim. |
| MF12 | blocked | `mf12-blocker.json` | FNM+CFD workflow; AMD curves / areas unpublished. |
| MF13 | discrepancy documented | `examples/mf13-card-cabinet-*.hydroflow.json`, `mf13-figs-digitized.json`, `out/mf13-fig3-4-comparison.tsv`, `mf13-discrepancy.json` | Figs 3–4 digitized (±1.5 CFM). Friction-only near-flat. Idelchik tees: far/near ≈ 1.57 vs paper ≈ 10.6 (right direction, wrong magnitude). Design II taper + tees steepens rather than flattening Fig 4. No momentum hack. |
| MF14 | partial | `examples/mf14-enclosure.hydroflow.json`, `out/mf14-enclosure-comparison.tsv`, `mf14-totals.json` | Dual fans + EMI 51% + 12 passages + bypass. Handbook total within ~13% of published FNM 65.8 CFM (no CFD passage curves; no answer-fit rQuad). |
| MF15 | blocked | `mf15-blocker.json` | Power-supply internals; compact curves / Figs. 8–11 not tabulated. |

## Physics upgrades landed for these cases

- Optional `geometry.A` (flow area) with `D` as hydraulic diameter for rectangular ducts/slots (`src/engine/friction.ts`, schema).
- Sharp 90° tee junctions after Idelchik, *Handbook of Hydraulic Resistance*, 4th ed., Chapter 7 (`node.tee`, default `correlation: "idelchik"`, `src/engine/tee.ts`). A junction node names its side-branch link; the other one or two incident links are the equal-area run. The solver picks dividing or combining from the solved flow directions and adds the run-leg and branch-leg static drops to the link residuals. Node pressure is the static pressure of the tee's common channel. Diagrams used: 7.18 and 7.20 (dividing branch and run), 7.4 with Table 7.1 (combining branch and run). `tests/tee.test.ts` checks the handbook identities (dividing branch static drop ρw_s², combining branch static rise ρ(w_c² − w_st²), Bernoulli bounds on the run legs, q = 1 sharp-elbow limit, net dissipation ≥ 0 for every q).
- Optional Gardel sharp 90° tee family (`node.tee.correlation: "gardel"`): Gardel (1957) as transcribed in Vasava (2007) eqs. 5.7–5.11; combining coefficients match Blaisdell & Manson (USDA TB 1283, 1963) with r★ → 0. Unit tests cover q = 0/1 limits, equal-area closed forms, K32 independence of a, dividing dissipation in the calibrated a band, and mid-q branch ζ below Idelchik. No ζ scaling to match figures.

## MF03 Fig 3 with tees: why the sharp-tee model does not close the gap

Fig 2 of the paper puts a tee at every header/lateral junction, so the tee variant (`examples/mf03-cold-plate-header-*-tees.hydroflow.json`) is the faithful topology. It matches Fig 3 worse than the friction-only replay. Every number below comes from `npx vitest run tests/mf03Header.test.ts` (writes `out/mf03-fig3-comparison.tsv`) and the digitized bars in `tests/fixtures/paper/mf03-fig3-digitized.json`, which were re-measured pixel by pixel on the raster embedded in the PDF (bars sum to 5.01 gpm against the imposed 5 gpm; the earlier eyeballed values summed to 5.14 gpm).

| variant | 7/16" max/min | 7/16" max rel err | 7/8" max rel err |
|---|---|---|---|
| Fig 3 (MacroFlow) | 2.12 | — | — |
| friction-only | 1.67 | 12.7% | 4.9% |
| Idelchik sharp tees | 1.38 | 21.7% | 4.9% |
| Gardel sharp tees | 2.61 | 10.4% | 3.3% |

Gardel moves the 7/16" profile *toward* Fig 3 (cuts max rel err vs Idelchik) but overshoots the paper max/min (2.61 vs 2.12). It does not close the figure. Evidence: `out/mf03-fig3-comparison.tsv`, examples `*-gardel.hydroflow.json`.

What was tried, all in a standalone U-manifold prototype that reproduces the engine bit for bit, before the tee model shipped:

- Idelchik sharp tees on all fourteen junctions: 21.7%.
- Idelchik branch coefficients with ideal 1-D momentum run legs (full Bernoulli recovery in the feed header, momentum mixing in the collector): 16.1%. The side-branch entry loss dominates header recovery in this geometry.
- Static versus total pressure at the nodes: identical results. Dynamic-pressure conversions cancel around every loop of a symmetric U-manifold, so only the ζ values matter.
- Elbows instead of tees at the far end, as drawn in Fig 2: 44.7% friction-only (starves passage 7), 21.8% with tees, because the q = 1 tee is already the sharp-elbow limit.
- Header as 7/16" OD with a 0.032" wall (ID 0.3735"), laterals 1/4" ID, friction-only: 8.3%. Rejected. The paper says diameter, and reading both tubes as OD gives 22.5%.
- Diagnostic only, not shipped: scaling the sharp-tee branch coefficients while keeping the run coefficients gives 3.9% at 0.5× for both headers (max/min 2.04 vs 2.12 and 1.06 vs 1.10). Run-only or branch-only scaling is far off. This says the bars are consistent with a smoother branch entry or a different correlation family, but fitting that factor to the bars is forbidden by policy.

Why this stays open: Fig 3 is MacroFlow's own FNM output with its unpublished tee correlation, not a measurement. Idelchik sharp tees flatten (21.7%). Gardel sharp tees (`correlation: "gardel"`) cut max rel err to 10.4% but overshoot max/min (2.61 vs 2.12). The friction-only replay stays the ≤15% fence; tee variants stay ≤25%. Next: rounded-entry wye if hardware supports it. No ζ scaling.

## MF13 Figs 3–4 with tees

Digitized bars (`mf13-figs-digitized.json`, ±1.5 CFM): Design I sums to 191 CFM with far/near ≈ 10.6; Design II sums to 191 CFM with mid-passages ~18 CFM and Pass-10 ~31 CFM. Hydro-flow with a synthetic fan from the published 0.8 inH2O / 240 CFM endpoints:

| Design I | far/near | sum CFM |
|---|---|---|
| Fig 3 (digitized) | 10.6 | 191 |
| friction-only | 0.99 | 138 |
| Idelchik sharp tees | 1.57 | 139 |
| Gardel sharp tees | 1.62 | 142 |

Tees move the profile in the paper's direction but stop far short of the spike. Gardel is only a small step past Idelchik on far/near. Design II + tees steepens rather than flattening Fig 4. Evidence: `out/mf13-fig3-4-comparison.tsv`, `mf13-discrepancy.json`. No momentum special case.

## Open physics gaps (do not paper over)

1. **Tee correlation family for MF03 and MF13.** Idelchik and Gardel sharp 90° tees are implemented (`node.tee.correlation`). On MF03 7/16" Idelchik flattens (21.7%); Gardel improves max rel to 10.4% but overshoots max/min. On MF13 Design I both give mild far-passage bias (far/near ≈ 1.57–1.62 vs digitized ≈ 10.6). See MF03/MF13 sections and `tee-gardel-blocker.json` (status: implemented). Next: rounded-entry wye if hardware supports it. No momentum hack / ζ scaling.
2. **MF09 clearance topology.** Paper uses distinct side and top bypass ducts; current model is one equivalent slot.
3. **Vendor fan curves.** MF08/MF13 use synthetic curves from published max points / goals only, never MacroFlow binary catalogs. Absolute CFM still limited by missing full impedance maps.
4. **Energy + Rth(Q)** without vendor catalog scrape. MF03 R2 now has fixed-rTh energy (directional T&lt;60 °C); Lytron Rth(Q) curves remain out of bounds. MF04 energy path exists but manifold geometry is sparse.
