# AGENTS.md

This repository is an **AI-first Flow Network Modeling tool**. Coding agents working here, and design agents using the product, share one contract: the project JSON is the source of truth; `hydroflow` on the command line is how you solve and optimize it.

Read this file first. Depth lives in the docs listed at the bottom.

---

## What this repo is

A modern clone of MacroFlow-style 1-D network hydraulics (nodes hold pressure, links hold flow). Public methodology only. No vendor catalogs, no unpublished file format, no chip-junction temperatures.

The canvas, when it exists, is a **viewer** of the same JSON the CLI writes. If you can only click Solve, the product is unfinished.

P0 is done when this works with no browser:

```bash
hydroflow goldens && hydroflow solve examples/series-pipes.hydroflow.json
```

Q within 1% of `tests/fixtures/goldens.json` case A (`3.471278803556e-3` m³/s).

The binary is **not shipped yet**. Until it is, do not invent a second solver in the prompt. Write docs, fixtures, and schema. When the binary lands, call it.

Until `hydroflow` exists, the repo gate is:

```bash
npm install
npm run check
```

`npm run check` validates project JSON, example graphs, golden file refs, and the process files. It is not a solve. GitHub Actions runs the same command on every pull request.

---

## Do first

1. Read `docs/TOOL_CONTRACT.md` (verbs, envelopes, exit codes).
2. Read `docs/AGENT_PLAYBOOK.md` (how to run a design loop).
3. Open `examples/series-pipes.hydroflow.json` and `tests/fixtures/README.md` (hydrostatic Convention A).
4. Leave artifacts under `dogfood/` if you change a network and claim it is better. See `dogfood/README.md`.

---

## Hard rules

- Store SI. Display units are a view.
- Example `pFixed` already includes `Patm + ρ g z`. Do **not** add `ρ g Δz` on links. Golden A driving Δp is 146834.97 Pa.
- `status != converged` is a failed tool call. Do not score it, optimize on it, or quote its Q as a design.
- Never overwrite the user's project in place. Write `*.whatif.json` / `*.opt.json` plus a `dogfood/` folder.
- One objective. Bounds on every decision variable. No `eval()` of free-form expressions — allow-listed `expr` names only.
- Density is an input. Elevation is applied once. Stay on the pump curve.
- Do not scrape Lytron / Rotron / Entegris catalogs.
- Do not treat MF06/MF08 hardware CFM tables as 1% goldens (those papers are a 10–18% band).
- Do not claim chip temperatures.
- If `hydroflow goldens` fails, stop. The instrument is broken.

---

## Agent loop

```
validate → solve baseline → score
  → (whatif | sweep | optimize) with a budget
  → discard any candidate that did not converge
  → compare / explain
  → write dogfood/<stamp>-<job>/{base,best,score,trace}
```

Start from `examples/`, not a 40-node invention. Change one family of variables at a time (D *or* K *or* enable/disable).

Recipes: playbook R1–R7 and tool-contract D1–D7.

---

## Exit codes (summary)

Canonical table: `docs/TOOL_CONTRACT.md` §3.

| Code | Meaning |
|---|---|
| 0 | OK and converged |
| 2 | Schema / graph invalid |
| 3 | Diverged or max-iter / max-time |
| 4 | Singular / missing pressure BC |
| 5 | Optimize budget, no feasible point |
| 6 | Converged but constraints failed |
| 64 | Usage |

Switch on the code before trusting JSON fields.

---

## Repo process

- Enable and use pstack. Start nontrivial work with `/poteto-mode`.
- Branch from `main`. Open a pull request. Fill `.github/PULL_REQUEST_TEMPLATE.md`. See `CONTRIBUTING.md`.
- Use Conventional Commits. One concern per pull request.
- Stacked work: the child pull request targets the parent branch.
- Run `npm run check` before you push. Do not claim a solve is verified until `hydroflow goldens` exists and passes.

When `hydroflow` lands, extend `.cursor/skills/verify-hydro-flow/` so agents drive the CLI (and later the canvas viewer). Until then, that skill runs `npm run check`.

---

## Docs map

| File | Use |
|---|---|
| `docs/TOOL_CONTRACT.md` | CLI / MCP machine interface |
| `docs/AGENT_PLAYBOOK.md` | Operating manual + optimization recipes |
| `docs/WORKFLOWS_AND_ACCEPTANCE.md` | Product workflows and U/I/E/S tests |
| `docs/VERIFICATION_CASES.md` | Paper-derived cases and accuracy policy |
| `docs/MACROFLOW_RESEARCH.md` | What MacroFlow is |
| `docs/schema/hydroflow.project.schema.json` | Project API |
| `tests/fixtures/goldens.json` | P0 numeric gates |
| `dogfood/README.md` | How to leave a replayable run |
| `CONTRIBUTING.md` | Branching, commits, pull requests |

Schema version on every envelope. Silent key renames are bugs.
