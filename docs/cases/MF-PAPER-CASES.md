# MacroFlow paper-case replays (§7)

Inventory and side-by-side status for publication cases listed in `docs/MACROFLOW_RESEARCH.md` §7.

## Policy

- Analytic P0 goldens stay ≤1% on Q.
- Paper replays compare to digitized figures or published tables.
- Digitization uncertainty is recorded in `tests/fixtures/paper/*-digitized.json`.
- Do not special-case the solver to match a bar chart. Close gaps with handbook physics (tees, rectangular `A`+`Dh`) or document the remaining discrepancy here.

## Status

| Case | Paper | Status | Evidence | Notes |
|---|---|---|---|---|
| R1 header maldistribution | MF03 | implemented | `examples/mf03-cold-plate-header-*.hydroflow.json`, `tests/mf03Header.test.ts`, `tests/fixtures/paper/out/mf03-fig3-comparison.tsv` | Max rel err vs Fig 3 ≈12.7% on original 7/16" (passage 1). Modified 7/8" ≤4.4%. Gap attributed to missing Idelchik tee inertia (not yet in constitutive). Larger header flattens max/min as required. |
| R6 bypass | MF09 | implemented | `examples/mf09-heat-sink-bypass.hydroflow.json`, `tests/mf09Bypass.test.ts`, `tests/fixtures/paper/out/mf09-fig4-comparison.tsv` | Monotonic sink-fraction decline passes. Mid-curve abs error up to ~0.25 vs digitized Fig 4 with slot `Dh=2·gap` + channel `A`. Further tee/orifice detail needed for tighter numeric match. |
| R4/R5 server bypass | MF08 | pending | Table 1 CFM targets known | Needs vendor fan curves + full impedance map; reconstruct with documented synthetic fan from published goals only when geometry is complete. |
| R7 taper cabinet | MF13 | pending | Fan max 0.8 inH2O / 240 CFM; 18° taper | Needs tee inertia for Design I far-passage bias. |
| R8 telecom cabinet | MF14 | pending | FNM 65.8 vs test 66.6 CFM | Historical band; passage bars in Fig 5. |
| R2 orifice loop | MF03 | pending | 6.8 gpm; loads; T&lt;60°C | Needs energy + cold-plate `Rth(Q)` without scraping Lytron catalogs. |
| R3 microchannel | MF04 | pending | | Energy pack. |
| R10 manifold | MF11 | pending | | Composite curve reuse. |
| R9 BTS dual net | MF07 | pending | | Multi-graph P3+. |
| R11 / MF01 / MF06 | MF01/MF06 | deferred | | Sparse / altitude / historical accuracy bands; do not 1%-golden CFM tables. |
| MF02 | MF02 | none | | Methodology only. |
| MF05/10/12/15 | — | low | | Sparse absolute Q in extracts. |

## Physics upgrades landed for these cases

- Optional `geometry.A` (flow area) with `D` as hydraulic diameter for rectangular ducts/slots (`src/engine/friction.ts`, schema).

## Open physics gaps (do not paper over)

1. **Tee inertia / Idelchik dividing–combining K(q).** Required for MF03 original-header severity and MF13 Design I far-passage bias.
2. **MF09 clearance topology.** Paper uses distinct side and top bypass ducts; current model is one equivalent slot.
3. **Vendor fan curves.** MF08/MF13/MF14 need published max points plus a documented curve shape, never MacroFlow binary catalogs.
