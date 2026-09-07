# Agent notes for hydro-flow

1-D flow-network modeling in the browser. The engine lives in `src/engine`, the canvas in `src/ui`. Research lives in `docs/MACROFLOW_RESEARCH.md`. Workflows live in `docs/WORKFLOWS_AND_ACCEPTANCE.md`. Verification cases live in `docs/VERIFICATION_CASES.md`. The project file schema is `docs/schema/hydroflow.project.schema.json` and matches `src/engine/types.ts`.

## Commands

```bash
npm install
npm run check
npm test
npm run dev
```

`npm run check` is the schema/contract gate. GitHub Actions runs it on every pull request. `npm test` is Vitest: hydraulics, energy, HEX, DLC, and P0 goldens within 1% on flow. `npm run dev` starts the Vite canvas.

## Process

- Enable and use pstack. Start nontrivial work with `/poteto-mode`.
- Branch from `main`. Open a pull request. Fill `.github/PULL_REQUEST_TEMPLATE.md`.
- Use Conventional Commits. One concern per pull request.
- Stacked work: the child pull request targets the parent branch.

## Product fences

- Reimplement the published FNM method. Do not copy MacroFlow's name, artwork, vendor catalogs, or unpublished binaries.
- Do not invent a native MacroFlow file format. Validate `.hydroflow.json` files against the schema.
- Store SI internally.
- Runtime model: `version`, `fluids` map, per-node/per-link `fluid`, polynomial pump/fan `coeffs`, HEX `couplings`, Churchill Darcy friction, hydrostatic from node `z` with `pFixed` as absolute pressure (Patm on free surfaces).
- P0 acceptance is `tests/fixtures/goldens.json` within 1% on flow, enforced by `tests/goldens.test.ts`.

## Layout

- `src/engine` — Newton hydraulics + linear ε-NTU energy
- `src/ui` — Vite + React + XYFlow editor
- `examples/*.hydroflow.json` — including the compiled DLC worked example
- Do not split into `packages/solver` / `apps/web` unless a later change explicitly migrates this tree
