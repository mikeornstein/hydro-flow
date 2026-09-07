# MacroFlow paper-case replays (§7)

Inventory and side-by-side status for publication cases listed in `docs/MACROFLOW_RESEARCH.md` §7.

Blocked / deferred / anchor extracts were re-mined in `docs/cases/MF-BLOCKED-PAPERS-MINING.md` (2026-09-07). That report quotes the `/tmp/mf-papers` text; it does not add solver cases.

## Policy

- Analytic P0 goldens stay ≤1% on Q.
- Paper replays compare to digitized figures or published tables.
- Digitization uncertainty is recorded in `tests/fixtures/paper/*-digitized.json`.
- Do not special-case the solver to match a bar chart. Close gaps with handbook physics (tees, rectangular `A`+`Dh`) or document the remaining discrepancy here.

## Status (MF01–MF15)

| Paper | Status | Evidence | Notes |
|---|---|---|---|
| MF01 | deferred | mining: `MF-BLOCKED-PAPERS-MINING.md` | Table 2 fans clean (0.15 in / 66 SCFM; 0.28 in / 74 SCFM). Table 1 B OCR-flagged; Figs. 5–6 not tabulated. Pattern only (I8 ×4). |
| MF02 | none | — | Methodology / process paper; no reconstructible network. |
| MF03 R1 | implemented | `examples/mf03-cold-plate-header-*.hydroflow.json`, `tests/mf03Header.test.ts`, `out/mf03-fig3-comparison.tsv` | Friction-only replay: max rel err vs Fig 3 12.7% (7/16"), 4.9% (7/8"). Idelchik sharp-tee replay (`-tees` files): 21.7% (7/16"), flatter than the paper. Fig 3 is a MacroFlow prediction; see the MF03 tee section below. |
| MF03 R2 | partial (flow-only) | `examples/mf03-orifice-balance-tuned.hydroflow.json`, `out/mf03-orifice-comparison.tsv` | Tuned orifices raise high-load branch share. Extract defines Rth as (T_component − T_inlet)/power and plots it only on Lytron Fig 5 — no formula, no Rth(Q) table. Ts < 60 °C stays blocked without a user-imported curve. |
| MF04 | partial | `examples/mf04-orifice-balanced.hydroflow.json`, `out/mf04-orifice-energy.tsv`, `mf04-blocker.json` | fRe 57/62, loads 70/120/200 W, unbalanced bases 33.1/42.3/49.8 °C from PDF. Orifice rebalance + energy `rTh`/`q` implemented; manifold channel count / Nu / inlet T sparse → absolute T not a 1% golden. |
| MF05 | blocked | mining: `MF-BLOCKED-PAPERS-MINING.md` | Tables 2–7 are rich (780/269 CFM model; measured A–N). Blocker is unpublished fan-tray / slot / filter meter curves, not missing Q. |
| MF06 | deferred | mining: `MF-BLOCKED-PAPERS-MINING.md` | Tables 2–3 publish R (in H2O/CFM²); Table 4 is 338/398/398 and 158/163/180 CFM. Engine-feasible as `rQuad` + imposed section Q (Ellison n=2). Fan-intersection Q still needs vendor curves. Historical 10–18% band; not a 1% golden. |
| MF07 | blocked | mining: `MF-BLOCKED-PAPERS-MINING.md` | No single-network Q subset. 1.7 kW / +52 °C / p=AQ²; A, fans, solar W, Figs. 5/7/8 unpublished. Engine `hex` can sit in one project; dual-graph UI is still P3+. |
| MF08 | partial | `examples/mf08-server-fan-caseB.hydroflow.json`, `out/mf08-fan-impedance.tsv`, `mf08-table1.json` | Synthetic fan from goals + chassis/PCI/exhaust. Case B: proc avg 1.3% / total 10.6% vs Table 1; A→B→C processor direction holds. Not a vendor catalog. |
| MF09 | implemented | `examples/mf09-heat-sink-bypass.hydroflow.json`, `out/mf09-fig4-comparison.tsv` | Monotonic sink-fraction decline. Mid-curve abs err ≤~0.25 vs digitized Fig 4. |
| MF10 | blocked | mining: `MF-BLOCKED-PAPERS-MINING.md` | Tables 1–2 Q/T are complete for zones 1/3/4/6. Blocker is experimental BIB impedance + unpublished DUT heat, not missing tables. |
| MF11 | implemented (pattern + Table 1 LCM) | `examples/mf11-lcm-table1.hydroflow.json`, `out/mf11-table1-hierarchy.tsv`, `mf11-table1.json` | LCM golden pinned at 0.12 gpm @ 3.50 psig. Hierarchy 1 / 28 / 113 parallel LCMs; row/system within ~2% of Table 1 Q at LCM ΔP. Hardware 10% band is the publication claim. |
| MF12 | blocked | mining: `MF-BLOCKED-PAPERS-MINING.md` | Pure FNM numbers exist (344/359 first-pass; 383/397 final; 11.3 m/s; Table 1–2 FNM columns). AMD curves and areas unpublished — do not replay. |
| MF13 | discrepancy documented | `examples/mf13-card-cabinet-*.hydroflow.json`, `mf13-figs-digitized.json`, `out/mf13-fig3-4-comparison.tsv`, `mf13-discrepancy.json` | Figs 3–4 digitized (±1.5 CFM). Friction-only near-flat. Idelchik tees: far/near ≈ 1.57 vs paper ≈ 10.6 (right direction, wrong magnitude). Design II taper + tees steepens rather than flattening Fig 4. No momentum hack. |
| MF14 | anchors only | `mf14-totals.json`; mining: `MF-BLOCKED-PAPERS-MINING.md` | FNM 65.8 vs test 66.6 recorded. Reconstructible: 13 PCB @ 0.8", 17° ramp, EMI 51%/0.31", 2×(0.24 in / 45 CFM), bypass, 90° exit. Not reconstructible: Fig 3 Δp(Q), card L×W×H, Fig 5 branch CFM. Rejected lumped rQuad fit to the answer. |
| MF15 | blocked | mining: `MF-BLOCKED-PAPERS-MINING.md` | 20 boards × 4 fans; 20×12×65 in; ~6 kW. Forward/reverse compact curves and Figs. 8–11 not tabulated. Combining-manifold inequalities only. |

## Physics upgrades landed for these cases

- Optional `geometry.A` (flow area) with `D` as hydraulic diameter for rectangular ducts/slots (`src/engine/friction.ts`, schema).
- Sharp 90° tee junctions after Idelchik, *Handbook of Hydraulic Resistance*, 4th ed., Chapter 7 (`node.tee`, `src/engine/tee.ts`). A junction node names its side-branch link; the other one or two incident links are the equal-area run. The solver picks dividing or combining from the solved flow directions and adds the run-leg and branch-leg static drops to the link residuals. Node pressure is the static pressure of the tee's common channel. Diagrams used: 7.18 and 7.20 (dividing branch and run), 7.4 with Table 7.1 (combining branch and run). `tests/tee.test.ts` checks the handbook identities (dividing branch static drop ρw_s², combining branch static rise ρ(w_c² − w_st²), Bernoulli bounds on the run legs, q = 1 sharp-elbow limit, net dissipation ≥ 0 for every q).

## MF03 Fig 3 with tees: why the sharp-tee model does not close the gap

Fig 2 of the paper puts a tee at every header/lateral junction, so the tee variant (`examples/mf03-cold-plate-header-*-tees.hydroflow.json`) is the faithful topology. It matches Fig 3 worse than the friction-only replay. Every number below comes from `npx vitest run tests/mf03Header.test.ts` (writes `out/mf03-fig3-comparison.tsv`) and the digitized bars in `tests/fixtures/paper/mf03-fig3-digitized.json`, which were re-measured pixel by pixel on the raster embedded in the PDF (bars sum to 5.01 gpm against the imposed 5 gpm; the earlier eyeballed values summed to 5.14 gpm).

| 7/16" header, passage | 1 | 2 | 3 | 4 | 5 | 6 | 7 | max/min | max rel err |
|---|---|---|---|---|---|---|---|---|---|
| Fig 3 (MacroFlow) | 1.117 | 0.898 | 0.745 | 0.631 | 0.555 | 0.526 | 0.536 | 2.12 | — |
| friction-only junctions | 0.978 | 0.837 | 0.732 | 0.660 | 0.615 | 0.593 | 0.586 | 1.67 | 12.7% |
| Idelchik sharp tees | 0.882 | 0.791 | 0.721 | 0.673 | 0.644 | 0.637 | 0.652 | 1.38 | 21.7% |

Both models agree with the 7/8" bars within 5%. The 7/16" pressure budget shows the mechanism. With tees the header statics do move the way the paper argues (feed rises 4.4 kPa toward the far end from momentum recovery, collector rises 9.6 kPa), so the feed-to-collector differential falls from 7.8 kPa at passage 1 to 2.6 kPa at passage 7. But the sharp-tee legs load the laterals unevenly: the dividing branch costs ρw_s² of static pressure and the combining branch ρ(w_c² − w_st²), which is 6.5 kPa on passage 1 against 1.3 kPa of tube friction, and 1.9 kPa on passage 7 against 0.8 kPa. The lateral resistance grows faster toward the inlet than the differential does, so the distribution flattens.

What was tried, all in a standalone U-manifold prototype that reproduces the engine bit for bit, before the tee model shipped:

- Idelchik sharp tees on all fourteen junctions: 21.7%.
- Idelchik branch coefficients with ideal 1-D momentum run legs (full Bernoulli recovery in the feed header, momentum mixing in the collector): 16.1%. The side-branch entry loss dominates header recovery in this geometry.
- Static versus total pressure at the nodes: identical results. Dynamic-pressure conversions cancel around every loop of a symmetric U-manifold, so only the ζ values matter.
- Elbows instead of tees at the far end, as drawn in Fig 2: 44.7% friction-only (starves passage 7), 21.8% with tees, because the q = 1 tee is already the sharp-elbow limit.
- Header as 7/16" OD with a 0.032" wall (ID 0.3735"), laterals 1/4" ID, friction-only: 8.3%. Rejected. The paper says diameter, and reading both tubes as OD gives 22.5%.
- Diagnostic only, not shipped: scaling the sharp-tee branch coefficients while keeping the run coefficients gives 3.9% at 0.5× for both headers (max/min 2.04 vs 2.12 and 1.06 vs 1.10). Run-only or branch-only scaling is far off. This says the bars are consistent with a smoother branch entry or a different correlation family, but fitting that factor to the bars is forbidden by policy.

Why this stays open: Fig 3 is MacroFlow's own FNM output with its unpublished tee correlation, not a measurement, so agreement means reproducing that correlation. Idelchik's sharp-edge diagrams are the published option and they flatten the distribution. The friction-only replay stays the acceptance fence (≤15%) and the tee replay is fenced at ≤25% so a coefficient change is noticed. Next candidates, in order: the Gardel-based correlations compiled by Rennels and Hudson (*Pipe Flow*, 2012, chapter 16), whose sharp-tee branch coefficients near the inlet come out 15–20% below Idelchik's on a first estimate, so they would move the number without closing it alone; Idelchik's improved-shape wye diagrams for a rounded branch entry, if the hardware can be shown to have one.

## MF13 Figs 3–4 with tees

Digitized bars (`mf13-figs-digitized.json`, ±1.5 CFM): Design I sums to 191 CFM with far/near ≈ 10.6; Design II sums to 191 CFM with mid-passages ~18 CFM and Pass-10 ~31 CFM. Hydro-flow with a synthetic fan from the published 0.8 inH2O / 240 CFM endpoints:

| Design I | far/near | sum CFM |
|---|---|---|
| Fig 3 (digitized) | 10.6 | 191 |
| friction-only | 0.99 | 138 |
| Idelchik sharp tees | 1.57 | 139 |

Tees move the profile in the paper's direction but stop far short of the spike. Design II + the same tees reaches far/near ≈ 3.8 (steeper), while Fig 4 is flatter mid-span. Evidence: `out/mf13-fig3-4-comparison.tsv`, `mf13-discrepancy.json`. Same next correlation candidates as MF03; no momentum special case.

## Open physics gaps (do not paper over)

1. **Tee correlation family for MF03 and MF13.** Idelchik sharp 90° tees are implemented (`node.tee`). On MF03 7/16" they flatten (21.7% vs 12.7% friction-only). On MF13 Design I they produce mild far-passage bias (far/near ≈ 1.57 vs digitized Fig 3 ≈ 10.6) — right direction, wrong magnitude — and Design II taper steepens rather than flattening Fig 4. See MF03 section and `mf13-discrepancy.json`. Next: Gardel / Rennels–Hudson, or rounded-entry wye if hardware supports it. No momentum hack.
2. **MF09 clearance topology.** Paper uses distinct side and top bypass ducts; current model is one equivalent slot.
3. **Vendor fan curves.** MF08/MF13 use synthetic curves from published max points / goals only, never MacroFlow binary catalogs. Absolute CFM still limited by missing full impedance maps.
4. **Energy + Rth(Q)** for MF03 R2 thermal targets without scraping vendor catalogs. The extract only *defines* Rth (inlet-referenced, function of Q) and points at Lytron Fig 5. Engine `rTh` is a constant, mean-fluid resistance. MF04 has an energy path with `rTh`/`q` but sparse manifold geometry.
