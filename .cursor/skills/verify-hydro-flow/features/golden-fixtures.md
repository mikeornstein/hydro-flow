# Golden fixtures

P0 targets in `tests/fixtures/goldens.json`. Cases A–D are hand calculations from `scripts/goldens-reference.mjs` (Swamee–Jain, bisection, no engine code). Case E is an engine regression pin. Solver flow must land within 1% of these Q values.

## Sub-features

- Case A series pipes
- Case B pump loop (`H = 30 − 2000 Q²`)
- Case C parallel pipes
- Case D emitter `Q = k ΔP^x` (`examples/emitter.hydroflow.json`, 2.0 L/h at 100 kPa, fed at 150 kPa)
- Case E DLC pumped cooling (`examples/dlc-pumped-cooling.hydroflow.json`)

## How to get to it (user POV)

An engineer checks that a solved network matches the published golden, not that the JSON merely parses.

## Driving it

```bash
npm run check
npm test
```

`npm run check` proves each case with a `file` resolves, expected ids exist, and A–D equal the output of `scripts/goldens-reference.mjs`. `npm test` runs `tests/goldens.test.ts` against `solveSteady` within `tolerance.flowRelative` (0.01).

## Gotchas

- Engine friction is Churchill; the reference uses Swamee–Jain. They agree within 0.05% on A–C. Hydrostatics come from node `z`; `pFixed` on reservoirs is Patm.
- Regenerate A–D with `node scripts/goldens-reference.mjs --write` after editing an example. Never paste engine output into the fixture.
- Pump curves are polynomial `coeffs`, not `{Q, H}` tables.
