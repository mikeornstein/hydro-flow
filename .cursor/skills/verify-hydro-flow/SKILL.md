---
name: verify-hydro-flow
description: Prove hydro-flow behavior. Today that is npm run check against the project schema, example graphs, and goldens file refs. Use when asked to verify, before a PR, or after changing schema, examples, fixtures, or repo process files.
---

# Verify hydro-flow

There is no `hydroflow` binary yet. The real artifact is `npm run check`. When the CLI lands, add a Launch/Drive path that runs `hydroflow goldens` and `hydroflow solve`. When the canvas exists, it is a viewer of the same JSON. Do not fake a UI proof.

## Launch

No server. Install once from the repo root:

```bash
npm install
```

Ready when `npm run check` prints `all checks passed`.

## Doctor

Run this first whenever anything looks off:

```bash
npm run check
```

Pass is exit 0 and the line `all checks passed`. Fail is a `FAIL` line and a nonzero exit. If `ajv` is missing, run `npm install` and retry.

## Drive

The harness is the check script, not a browser.

1. From the repo root, run `npm run check`.
2. To prove a single example, keep that file under `examples/*.hydroflow.json` and re-run the check. The script validates every file in that directory against `docs/schema/hydroflow.project.schema.json` and walks node/link ids.
3. To prove a golden still points at a real graph, edit `tests/fixtures/goldens.json` only with the example. The check fails if a named link or node is missing.

Do not call internal setters or invent a solver run. Solver proof waits for `hydroflow goldens`.

## Evidence

Save the check transcript. It is the proof.

```bash
mkdir -p /tmp/verify-hydro-flow
npm run check | tee /tmp/verify-hydro-flow/check.txt
```

Proof standards:

- Exercise the committed files, not a rewritten fixture in `/tmp` that never lands.
- Capture the command output, including every `ok` / `FAIL` line.
- After a schema or example change, the transcript must include `matches schema` for each touched `examples/*.hydroflow.json` file.
- Cleanup must not delete `/tmp/verify-hydro-flow/`.

## Cleanup

Nothing to kill. Leave `/tmp/verify-hydro-flow/` in place.

## Helpers

`scripts/check.mjs` is the helper. Invoke it only through `npm run check` so the same command CI uses is the one you ran.
