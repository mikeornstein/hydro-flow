# Agent notes for hydro-flow

1-D flow-network modeling in the browser. Research lives in `docs/MACROFLOW_RESEARCH.md`. Workflows and acceptance tests live in `docs/WORKFLOWS_AND_ACCEPTANCE.md`. Verification cases live in `docs/VERIFICATION_CASES.md`. The project file schema is `docs/schema/hydroflow.project.schema.json`.

## Commands

```bash
npm install
npm run check
```

`npm run check` is the gate. GitHub Actions runs the same command on every pull request. There is no solver or web app to start yet.

## Process

- Enable and use pstack. Start nontrivial work with `/poteto-mode`.
- Branch from `main`. Open a pull request. Fill `.github/PULL_REQUEST_TEMPLATE.md`.
- Use Conventional Commits. One concern per pull request.
- Stacked work: the child pull request targets the parent branch.

## Product fences

- Reimplement the published FNM method. Do not copy MacroFlow's name, artwork, vendor catalogs, or unpublished binaries.
- Do not invent a native MacroFlow file format. Validate `.hydroflow.json` files against the schema.
- Store SI internally.
- P0 acceptance is `tests/fixtures/goldens.json` within 1% on flow. Do not trust a canvas until `tests/solver` exists and those goldens pass.

## Next product work

1. `packages/solver` with the P0 goldens as tests.
2. `apps/web` Vite + React + XYFlow shell that loads the JSON and calls a worker.

When those land, extend `.cursor/skills/verify-hydro-flow/` so agents drive the real canvas. Until then, the verify skill runs `npm run check`.
