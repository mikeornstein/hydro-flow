# Golden fixtures

P0 targets in `tests/fixtures/goldens.json`, produced by this engine. Solver flow must land within 1% of these Q values.

## Sub-features

- Case A series pipes
- Case B pump loop (`H = 30 − 2000 Q²`)
- Case C parallel pipes
- Case D emitter calibration (no project file yet — emitters are not in this engine)
- Case E DLC pumped cooling (`examples/dlc-pumped-cooling.hydroflow.json`)

## How to get to it (user POV)

An engineer checks that a solved network matches the published golden, not that the JSON merely parses.

## Driving it

```bash
npm run check
npm test
```

`npm run check` proves each case with a `file` resolves and expected ids exist. `npm test` runs `tests/goldens.test.ts` against `solveSteady` within `tolerance.flowRelative` (0.01).

## Gotchas

- Case D has `"file": null`. The check records that and still passes.
- Friction is Churchill, not Swamee–Jain. Hydrostatics come from node `z`; `pFixed` on reservoirs is Patm.
- Pump curves are polynomial `coeffs`, not `{Q, H}` tables.
