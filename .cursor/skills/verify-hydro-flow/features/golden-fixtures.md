# Golden fixtures

Hand-calculated P0 targets in `tests/fixtures/goldens.json`. Solver flow must land within 1% of these Q values once `tests/solver` exists.

## Sub-features

- Case A series pipes
- Case B pump loop
- Case C parallel pipes
- Case D emitter calibration (no project file yet)

## How to get to it (user POV)

An engineer checks that a solved network matches the published hand calc, not that the JSON parses.

## Driving it with npm run check

```bash
npm run check
```

Pass when each case with a `file` resolves, and every expected link and node id exists in that example. That is a fixture-integrity proof, not a solver proof.

A solver proof is `tests/solver` running those Q values within `tolerance.flowRelative` (0.01). Do not claim that proof until that suite exists.

## Gotchas

- Case D has `"file": null`. The check records that and still passes.
- Relative flow tolerance is 1%. Pressure uses the same relative tolerance once the solver writes node P.
