# Project files

Saved networks are `.hydroflow.json` files that match `docs/schema/hydroflow.project.schema.json`.

## Sub-features

- Schema version `0.1.0`
- Nodes with unique ids and kinds `junction` / `boundary` / `tank` / `plenum`
- Links whose `from` and `to` name existing nodes
- Constant-property water with numeric `rho` and `mu`

## How to get to it (user POV)

A user saves or opens a project. Until the canvas exists, the user-facing files are the committed examples:

- `examples/series-pipes.hydroflow.json`
- `examples/pump-loop.hydroflow.json`
- `examples/parallel-pipes.hydroflow.json`

## Driving it with npm run check

```bash
npm run check
```

Pass when the transcript contains `matches schema` and `graph ids resolve` for each of those three files.

## Gotchas

- Boundary `pFixed` in the examples already includes `Patm + ρ g z`. A solver that also applies elevation from node `z` double-counts head. See `tests/fixtures/README.md`.
- `results` is `null` on the examples. Do not treat a missing solve as a failed save.
