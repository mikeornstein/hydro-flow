---
name: verify-hydro-flow
description: Prove hydro-flow behavior. Run npm run check (schema, examples, goldens ids) and npm test (solver goldens, DLC, hydraulics). Use when asked to verify, before a PR, or after changing schema, examples, fixtures, engine, or UI.
---

# Verify hydro-flow

The contract gate is `npm run check`. Solver proof is `npm test`. The canvas is `npm run dev`.

## Launch

```bash
npm install
npm run check
npm test
```

Ready when check prints `all checks passed` and Vitest reports all tests passed. For the UI:

```bash
npm run dev
```

Open the printed local URL. The default project is the DLC pumped CDU + air-liquid HEX.

## Doctor

```bash
npm run check
npm test
```

Check pass is exit 0 and `all checks passed`. Test pass is Vitest exit 0. If `ajv` is missing, run `npm install` and retry.

## Drive

1. `npm run check` — schema + example graph ids + golden file refs.
2. `npm test` — Newton/energy solver including `tests/goldens.test.ts` (1% on Q) and `tests/dlcExample.test.ts`.
3. Optional: `npm run dev`, load the worked example, Solve, open the Proof tab.

Do not treat schema-only success as a solver proof.

## Evidence

```bash
mkdir -p /tmp/verify-hydro-flow
npm run check | tee /tmp/verify-hydro-flow/check.txt
npm test | tee /tmp/verify-hydro-flow/test.txt
```

Proof standards:

- Exercise committed files.
- After a schema or example change, the check transcript must include `matches schema` for each touched `examples/*.hydroflow.json`.
- After an engine change, `tests/goldens.test.ts` must pass.
- Cleanup must not delete `/tmp/verify-hydro-flow/`.

## Cleanup

Leave `/tmp/verify-hydro-flow/` in place. Do not kill the Vite server if you started it.

## Helpers

`scripts/check.mjs` only through `npm run check`. Vitest only through `npm test`.
