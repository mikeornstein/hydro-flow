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
| MF01 | deferred | — | Chassis B/fan tables OCR-unstable; do not invent missing cells. Pattern only (multiplicity). |
| MF02 | none | — | Methodology / process paper; no reconstructible network. |
| MF03 R1 | implemented | `examples/mf03-cold-plate-header-*.hydroflow.json`, `tests/mf03Header.test.ts`, `out/mf03-fig3-comparison.tsv` | Friction-only replay: max rel err vs Fig 3 12.7% (7/16"), 4.9% (7/8"). Idelchik sharp-tee replay (`-tees` files): 21.7% (7/16"), flatter than the paper. Fig 3 is a MacroFlow prediction; see the MF03 tee section below. |
| MF03 R2 | partial (flow-only) | `examples/mf03-orifice-balance-tuned.hydroflow.json`, `out/mf03-orifice-comparison.tsv` | Tuned orifices raise high-load branch share. T&lt;60°C needs energy + Rth(Q) without Lytron scrape. |
| MF04 | blocked | — | Microchannel + energy + Nu(aspect); confirm PDF loads before coding. |
| MF05 | blocked | — | Recirculation pattern only; sparse absolute Q. |
| MF06 | deferred | — | Historical 10–18% hardware band; altitude density note; not a 1% golden. |
| MF07 | blocked | — | Dual-network + HX handoff is P3+ product work. |
| MF08 | partial | `examples/mf08-bypass-balance.hydroflow.json`, `out/mf08-bypass-comparison.tsv`, `mf08-table1.json` | 36% open raises processor-path flow (Table 1 direction). Absolute CFM needs full map + fan curves. |
| MF09 | implemented | `examples/mf09-heat-sink-bypass.hydroflow.json`, `out/mf09-fig4-comparison.tsv` | Monotonic sink-fraction decline. Mid-curve abs err ≤~0.25 vs digitized Fig 4. |
| MF10 | blocked | — | Burn-in oven; sparse numeric extract. |
| MF11 | implemented (pattern) | `examples/mf11-composite-expanded.hydroflow.json`, `out/mf11-composite-comparison.tsv` | Expanded vs composite Q within 1%. Hardware 10% band not claimed. |
| MF12 | blocked | — | FNM+CFD workflow; not an FNM Q golden. |
| MF13 | blocked | `mf13-discrepancy.json` | Needs tee inertia for far-passage bias; friction-only is opposite; bad momentum attempt reverted. `node.tee` now exists but MF13 has not been replayed with it. |
| MF14 | anchors only | `mf14-totals.json` | FNM 65.8 vs test 66.6 recorded. Rejected lumped rQuad fit to the answer. |
| MF15 | blocked | — | Power-supply internals; sparse tabulated Q. |

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

## Open physics gaps (do not paper over)

1. **Tee correlation family for MF03 and MF13.** Idelchik sharp 90° tees are implemented (`node.tee`) and make MF03 7/16" flatter, not steeper (21.7% vs 12.7% friction-only). See the MF03 section above for evidence and the next correlations to try. A Bajura-style header momentum experiment worsened MF03 (~200% error) and was reverted.
2. **MF09 clearance topology.** Paper uses distinct side and top bypass ducts; current model is one equivalent slot.
3. **Vendor fan curves.** MF08/MF13/MF14 need published max points plus a documented curve shape, never MacroFlow binary catalogs.
4. **Energy + Rth(Q)** for MF03 R2 / MF04 thermal targets without scraping vendor catalogs.
