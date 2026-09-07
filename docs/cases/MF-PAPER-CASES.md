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
| MF03 R1 | implemented | `examples/mf03-cold-plate-header-*.hydroflow.json`, `tests/mf03Header.test.ts`, `out/mf03-fig3-comparison.tsv` | Max rel err vs Fig 3 ≈12.7% (7/16"); ≤4.4% (7/8"). Larger header flattens max/min. Tee inertia still open. |
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
| MF13 | blocked | `mf13-discrepancy.json` | Needs tee inertia for far-passage bias; friction-only is opposite; bad momentum attempt reverted. |
| MF14 | anchors only | `mf14-totals.json` | FNM 65.8 vs test 66.6 recorded. Rejected lumped rQuad fit to the answer. |
| MF15 | blocked | — | Power-supply internals; sparse tabulated Q. |

## Physics upgrades landed for these cases

- Optional `geometry.A` (flow area) with `D` as hydraulic diameter for rectangular ducts/slots (`src/engine/friction.ts`, schema).

## Open physics gaps (do not paper over)

1. **Tee inertia / Idelchik dividing–combining K(q).** Required for MF03 original-header severity and MF13 Design I far-passage bias. A Bajura-style header momentum experiment worsened MF03 (~200% error) and was reverted.
2. **MF09 clearance topology.** Paper uses distinct side and top bypass ducts; current model is one equivalent slot.
3. **Vendor fan curves.** MF08/MF13/MF14 need published max points plus a documented curve shape, never MacroFlow binary catalogs.
4. **Energy + Rth(Q)** for MF03 R2 / MF04 thermal targets without scraping vendor catalogs.
