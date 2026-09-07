# AI-first tool contract

Hydro-Flow is not only a canvas app. It is a **command-line instrument that agents call** to analyze and optimize fluid networks. If an agent cannot `validate → solve → score → mutate → solve` without a human at the GUI, the clone is incomplete.

This file is the machine interface. Narrative playbooks live in sibling docs when they land (`AGENTS.md`, `AGENT_PLAYBOOK.md`). Physics stay in [COMPONENT_MODELS.md](COMPONENT_MODELS.md) / [MACROFLOW_RESEARCH.md](MACROFLOW_RESEARCH.md). Tests stay in [VERIFICATION_CASES.md](VERIFICATION_CASES.md).

Dogfood rule: **we are the first agent**. Every session that claims to improve a network must leave a scored artifact a later agent can replay.

---

## 1. Design principles (agent-tool best practices)

Copied from tools agents actually survive (`jq`, `gh`, compilers, solvers), not from GUI products.

1. **No prompts.** Never `read` stdin for “continue?”. Flags or fail.
2. **Stdout is data. Stderr is log.** A pipe must yield parseable JSON on success *and* on structured failure.
3. **Exit codes are the first parse.** Do not hide divergence behind HTTP 200-style JSON with `ok: true`.
4. **SI in, SI stored.** Display units are a view. `--units IP` changes printing, never the file.
5. **Project files are immutable unless `--in-place` is explicit.** Default write is a new path.
6. **Unconverged is not a result.** `status != converged` ⇒ nonzero exit ⇒ ineligible for scoring/optimize.
7. **Deterministic when seeded.** Same project + same seed + same budget ⇒ same optimize trace.
8. **Schema version on every envelope.** Agents branch on `schemaVersion`, not on guesswork.
9. **One verb, one job.** `solve` does not optimize. `optimize` calls `solve` internally.
10. **Offline default.** No network. Fluids and correlations ship in-process.
11. **Timeouts.** `--max-seconds` kills a runaway Newton and returns `status: max-time`.
12. **Cheap preview.** `validate` and `graph-stats` must be milliseconds so agents can lint before they spend evals.

---

## 2. CLI surface

Proposed binary name: `hydroflow` (also `npx hydroflow` / `python -m hydroflow` — one argv contract).

```
hydroflow <verb> [flags] [file]
```

| Verb | Job |
|---|---|
| `version` | Print tool + schema versions |
| `schema` | Print JSON Schema for project and for result envelopes |
| `validate` | Lint project JSON against schema + graph rules |
| `solve` | Steady (or requested) network solve |
| `score` | Evaluate objectives/constraints on a *converged* result |
| `whatif` | Apply a patch, solve, print before/after |
| `sweep` | Cartesian or list sweep of one/two variables |
| `optimize` | Bounded search over variables against score |
| `compare` | Diff two result envelopes (Q, p, score) |
| `explain` | Human-readable bottleneck list from a result (also JSON) |

Global flags:

- `--project PATH` or positional file or `-` for stdin
- `--out PATH` (default stdout)
- `--log PATH` (default stderr)
- `--format json|table` (json default)
- `--max-iter N --max-seconds T --rel-tol EPS`
- `--seed N`
- `--quiet` / `--verbose`

---

## 3. Exit codes

| Code | Meaning |
|---|---|
| 0 | Success and, if a solve happened, **converged** |
| 2 | Validation / schema / graph error |
| 3 | Solve ran but diverged or hit max-iter / max-time |
| 4 | Ill-posed (no pressure BC, disconnected, singular Jacobian) |
| 5 | Optimize exhausted budget with no feasible point |
| 6 | Solve converged but constraints failed (`score` / `optimize`) |
| 64 | Usage / unknown verb / bad flag |

Agents must switch on the code *before* reading pretty fields.

---

## 4. Envelopes

### 4.1 Result (every `solve` / `whatif` / optimize candidate)

```json
{
  "schemaVersion": "0.1.0",
  "status": "converged",
  "residuals": { "mass": 1.2e-10, "momentum": 4e-9, "energy": null },
  "iterations": 6,
  "timingsMs": { "assemble": 1, "solve": 8 },
  "warnings": [],
  "nodes": { "mid": { "p": 261573.165, "T": null } },
  "links": { "pipe-1": { "Q": 0.0034712788, "V": 1.768, "Re": 88060, "dP": 35532 } },
  "derived": { "pumpPowerW": null, "maxVelocity": 2.76 }
}
```

`status` ∈ `converged | diverged | max-iter | max-time | singular | choked | validated`.

### 4.2 Score

```json
{
  "schemaVersion": "0.1.0",
  "feasible": true,
  "objectives": { "maldistribution": 0.041, "pumpPowerW": 210.3 },
  "weighted": 12.4,
  "constraints": [
    { "id": "qmin-a", "ok": true, "value": 0.00505, "limit": 0.004 }
  ],
  "violations": []
}
```

`feasible` is false if any constraint fails **or** the parent solve was not `converged`.

### 4.3 Patch (whatif / optimize variables)

JSON Pointer into the project file.

```json
{ "op": "set", "path": "/links/0/component/geometry/D", "value": 0.06 }
```

Allowed ops: `set`, `scale`, `remove-link`, `disable-link`. Disable is how fan-fail is expressed.

---

## 5. Optimization request

```json
{
  "schemaVersion": "0.1.0",
  "project": "examples/pump-loop.hydroflow.json",
  "variables": [
    {
      "id": "D",
      "path": "/links/1/component/geometry/D",
      "type": "continuous",
      "min": 0.03,
      "max": 0.08
    }
  ],
  "objectives": [
    { "id": "power", "sense": "min", "expr": "pumpPowerW", "weight": 1.0 }
  ],
  "constraints": [
    { "id": "qfloor", "expr": "links.pipe.Q", "op": ">=", "value": 0.004 }
  ],
  "budget": { "evals": 40, "wallSeconds": 20 },
  "algorithm": "coordinate",
  "seed": 1
}
```

`expr` names are either JSON paths into the result envelope or registered derived quantities (`pumpPowerW`, `maldistribution`, `minBranchQ`, `maxNodeT`, `pipeMassProxy`, `uniformity`).

Algorithms P0/P1 (no extra numeric stack required):

- `coordinate` — bound-constrained coordinate search, 1D golden-section per variable
- `random-then-local` — seeded random feasible start + coordinate polish
- `neldermead` — only after we have ≥ 2 continuous variables and a penalty-smoothed score

Not P0: gradient-through-Newton, genetic algorithms, integer pipe-schedule MIP. Those can wrap the same `solve` later.

**Hard rule:** a candidate with `status != converged` is discarded, not penalty-smoothed into a fake optimum.

---

## 6. MCP / tool-calling spec

Expose the same verbs as tools. One tool per verb. Descriptions must tell the model *when* to call them.

| Tool | When to call |
|---|---|
| `hydroflow_validate` | Before every solve. After every mutation. |
| `hydroflow_solve` | Need Q, p, T on a fixed network. |
| `hydroflow_score` | Have a converged result and a spec. |
| `hydroflow_whatif` | Single change (“what if D=60 mm”, “fan 3 off”). |
| `hydroflow_sweep` | One or two variables, want a curve. |
| `hydroflow_optimize` | More than ~5 manual what-ifs would be needed. |
| `hydroflow_compare` | Two designs already solved. |
| `hydroflow_explain` | Need a sentence-level bottleneck list. |

Tool args mirror the CLI flags. Tools return the JSON envelope **and** the exit code as a field `exitCode` so hosts that swallow process codes still see it.

Agent loop the host should implement (and that we dogfood):

```
validate(project)
solve(project) → if exit != 0: explain and stop
score(result, spec) → if feasible and good enough: report
else:
  optimize(project, spec) or a short whatif series
  validate + solve + score the winner
  compare(base, winner)
  write dogfood artifact
```

Never call `optimize` on a project that does not `validate`. Never report `optimize` output without printing `feasible` and `status`.

---

## 7. Registered objectives and constraints

These are the quantities agents should optimize. Names are stable.

| id | Sense | Meaning |
|---|---|---|
| `pumpPowerW` | min | ρ g Q H / η (or Q·Δp/η if Δp given) |
| `fanPowerW` | min | same for air |
| `pipeMassProxy` | min | Σ L·D·t_wall — schedule later |
| `maldistribution` | min | (Q_max − Q_min) / Q_mean on a named group |
| `uniformity` | max | 1 − maldistribution |
| `minBranchQ` | max | worst branch in a group |
| `maxVelocity` | min | erosion / noise proxy |
| `maxNodeT` | min | energy phase |
| `minPressure` | max | cavitation / emitter floor |
| `pressureAt` | target | equality constraint via two-sided inequality |

Irrigation pack: `minEmitterQ`, `emitterUniformity` (Christiansen CU later), `wettedMassProxy`.
Electronics pack: `minComponentQ`, `maxSurfaceT`, `fanFailMinQ` (score the failed network too).

---

## 8. Worked agent jobs (dogfood these first)

Each job is a command an agent must be able to finish unattended. Success = artifact under `dogfood/<date>-<job>/` containing `base.json`, `best.json`, `score.json`, `trace.jsonl`.

### D1 — Reproduce golden A

`hydroflow solve examples/series-pipes.hydroflow.json`

Expect Q = 3.471278803556e-3 m³/s ±1 %. This is the hello-world of agent trust.

### D2 — Size a discharge pipe against a pump

Start from `examples/pump-loop.hydroflow.json`. Variable: pipe D ∈ [0.03, 0.10]. Constraint: Q ≥ 0.005. Objective: min `pumpPowerW` (or min D if power is flat). Agent must not pick a D that drops off the pump curve without a `stall` warning in `warnings`.

### D3 — Balance two parallel pipes

Start from `examples/parallel-pipes.hydroflow.json`. Allow D of pipe-b only. Objective: min |Q_a − Q_b|. Expect the optimizer to return D_b ≈ D_a.

### D4 — MF03 orifice story, qualitative

Five branches with unequal heat (or unequal Q targets). Variables: five orifice K. Constraints: each Q ≥ target(load). Objective: min pump head. Agent should raise K on the greedy branches, not the starved ones.

### D5 — MF08 fan-fail

Network with N parallel fans. `whatif --disable links.fan-3` then `score` against `minComponentQ`. Optimize remaining-fan count or a perforated-plate open fraction until the failed case is feasible.

### D6 — Irrigation lateral

One header + N emitters `Q=kP^x`. Variables: header D, optionally inlet p. Constraints: every emitter Q ≥ Q_design. Objective: min header mass proxy. This is the hydro-pack dogfood; it does not exist as an example file yet — creating it is part of the job.

### D7 — Use the tool to grow the tool

After any D-job, if a candidate is interesting and converged, the agent proposes it as a new fixture in `tests/fixtures/` rather than pasting numbers into chat. That is how goldens scale.

---

## 9. Dogfood protocol (we are customer zero)

1. **No honor-system physics.** If we discuss a pipe size, an agent must have a `solve` envelope in the thread or in `dogfood/`.
2. **Every optimize leaves a trace.** `trace.jsonl` has one line per eval: `{eval, patch, status, score, feasible}`.
3. **Weekly ritual** once a CLI exists: run D1–D3 in CI. If D1 drifts >1 %, the engine regressed.
4. **Agents prefer the CLI over inventing Darcy–Weisbach in a scratchpad.** A hand calc is allowed only to *check* the CLI, not to replace it.
5. **Failed solves are first-class artifacts.** Keep `status: singular` outputs; they teach the explainer.
6. **Do not dogfood vendor catalogs.** Invent geometry + handbook K. Same legal line as the rest of the project.
7. **Human GUI is a viewer of the same files.** If the canvas cannot open a `best.json` the optimizer just wrote, the product is two products. Forbidden.

---

## 10. Anti-patterns

- Treating `exit 3` JSON as a design because the Q field was populated.
- Optimizing displayed gpm while the file is SI and rounding away the 1 % gate.
- Mutating `/tmp/project.json` in place so `compare` has no baseline.
- Sweeping D from 0 to 10 m and wondering why Re/f blew up.
- Calling `optimize` with empty constraints and celebrating a zero-pipe.
- Reporting MF08 CFM targets as 1 % goldens.
- An agent writing a new Python solver in the chat instead of calling `hydroflow solve`.

---

## 11. Minimum slice that makes this real

When implementation starts, the *first* shippable surface is not the canvas. It is:

```
hydroflow validate examples/series-pipes.hydroflow.json
hydroflow solve    examples/series-pipes.hydroflow.json
```

exit 0, Q within 1 % of golden A, JSON on stdout. That is enough for an agent to dogfood D1 and to refuse to trust anything else.

Canvas, optimize, energy, irrigation pack all wrap that verb.
