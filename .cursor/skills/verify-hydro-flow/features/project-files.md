# Project files

Saved networks are `.hydroflow.json` files that match `docs/schema/hydroflow.project.schema.json` (`src/engine/types.ts`).

## Sub-features

- `version` `0.1.0`
- `fluids` map; every node and link names a fluid id
- Nodes with unique ids and kinds `junction` / `boundary` / `tank`
- Links whose `from` and `to` name existing nodes
- Optional HEX `couplings` between two stream links
- Constant-property fluids with numeric `rho` and `mu`

## How to get to it (user POV)

A user saves or opens a project from the canvas (Save / Open) or commits an example:

- `examples/series-pipes.hydroflow.json`
- `examples/pump-loop.hydroflow.json`
- `examples/parallel-pipes.hydroflow.json`
- `examples/dlc-pumped-cooling.hydroflow.json`

## Driving it with npm run check

```bash
npm run check
```

Pass when the transcript contains `matches schema` and `graph ids resolve` for each file in `examples/`.

## Gotchas

- `pFixed` is absolute pressure. Free-surface reservoirs use Patm. Elevation is node `z`.
- Do not add a legacy `schemaVersion` / singular `fluid` / table `curve` field — the schema rejects them.
