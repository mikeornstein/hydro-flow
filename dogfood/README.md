# dogfood/

This directory is how Hydro-Flow eats its own cooking.

Agents (including future sessions in this repo) do not “optimize” a network in chat and paste a diameter. They run the CLI, then leave a replayable artifact here.

The folder is empty of runs until `hydroflow solve` exists. The layout below is the contract so the first run has a place to land.

## Layout

```
dogfood/
  README.md                 this file
  <YYYY-MM-DD>-<job>/
    base.json               project before the run
    spec.json               objectives + constraints + budget
    best.json               winning project (if feasible)
    score.json              score envelope for best.json
    result.json             solve envelope for best.json
    trace.jsonl             one line per eval: eval, patch, status, score, feasible
    notes.md                two-paragraph human summary, no new physics
```

Job names match [docs/TOOL_CONTRACT.md](../docs/TOOL_CONTRACT.md) §8:

| Job | First command |
|---|---|
| D1 | `hydroflow goldens && hydroflow solve examples/series-pipes.hydroflow.json` |
| D2 | size discharge pipe on `examples/pump-loop.hydroflow.json` |
| D3 | rebalance `examples/parallel-pipes.hydroflow.json` |
| D4 | MF03-style orifice balance |
| D5 | fan-fail what-if then recover |
| D6 | irrigation lateral, every emitter ≥ Q_design |
| D7 | promote a winner into `tests/fixtures/` |

## Ritual

1. Copy the starting example to `base.json`. Do not mutate `examples/` in place.
2. Write `spec.json` with one objective, hard constraints, bounds on every variable, eval budget.
3. Run `validate` → `solve` baseline → `optimize` / `whatif` → `compare`.
4. Discard every candidate with `status != converged`. Those still go in `trace.jsonl`.
5. If `feasible` is false, the run is a failed optimize (exit 5), not a smaller pipe.
6. Commit the folder. That commit is the evidence.

## What does not belong here

- Hand-calculated Q with no envelope
- Vendor catalog points
- GUI screenshots as the only record
- Unbounded “minimize D” specs (the starve-trap)

CI, once a binary exists, runs D1 on every engine change. D2–D3 when `optimize` exists. D4–D7 are scheduled.
