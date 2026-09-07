# Agent playbook: Hydro-Flow as an AI-first design tool

Hydro-Flow is not only a canvas app. It is a **command-line instrument** that language-model agents must be able to call, trust, and iterate on without a human clicking Solve.

This playbook is the operating manual. The machine contract (flags, JSON schemas, exit codes) belongs in `docs/AGENTS.md` when that lands. Workflows and product scope live in `docs/WORKFLOWS_AND_ACCEPTANCE.md`. Numeric gates live in `docs/VERIFICATION_CASES.md` and `tests/fixtures/goldens.json`.

**Dogfood rule:** if an agent on this team cannot improve a network by calling Hydro-Flow from a shell, the product is unfinished — even if the GUI looks complete.

---

## 1. Why CLI-first

MacroFlow was a 1990s desktop GUI. Agents cannot drive that. They can drive a tool that:

- reads and writes the versioned project JSON already specified in `docs/schema/hydroflow.project.schema.json`
- prints a structured solve result (status, residuals, node $P$, link $Q$) on stdout
- fails loudly on unconverged or singular systems
- accepts a **batch of mutated projects** and returns scored results
- is deterministic given the same JSON + same analysis flags

The GUI then becomes a viewer over the same files the agent writes. One model, two fronts. That is the dogfood architecture: humans and agents share `examples/*.hydroflow.json`.

---

## 2. Tool surface agents should assume

Names are indicative. The implementation may bikeshed flags; the **verbs** must exist.

| Verb | Purpose |
|---|---|
| `hydroflow validate <file>` | Schema + topology checks. No solve. |
| `hydroflow solve <file>` | Steady solve. JSON result to stdout. |
| `hydroflow diff <a> <b>` | Compare two result files: $\Delta Q$, $\Delta P$, mass residuals. |
| `hydroflow sweep <file> --set link.pipe-2.geometry.D=0.03,0.04,0.05` | One-parameter study. |
| `hydroflow size <file> --target link.emitter-1.Q=6.8e-7 --var link.lateral.geometry.D` | Inverse: change one variable to hit a target. |
| `hydroflow optimize <file> --objective ... --var ... --constraint ...` | Bounded search. |
| `hydroflow score <file> --spec <spec.json>` | Evaluate constraints + scalar objective without searching. |
| `hydroflow goldens` | Run `tests/fixtures/goldens.json`. Exit non-zero on miss. |

Every verb:

- reads SI from the project file (see hydrostatic Convention A in the fixtures README)
- writes SI in the result JSON
- uses process exit codes as a first-class API (section 4)
- never prints a result table when `status != converged`

Stdout is JSON. Human-readable logs go to stderr. Agents parse stdout; humans can `jq`.

---

## 3. Result contract agents must parse

Minimum solve payload:

```text
{
  "status": "converged | max-iter | diverged | singular | choked | invalid",
  "iterations": 12,
  "residual": 1.2e-11,
  "elapsedMs": 8,
  "warnings": ["fan near stall"],
  "nodes": { "mid": { "P": 261573.16 } },
  "links": { "pipe-1": { "Q": 0.003471, "dP": 35531.8, "V": 1.768, "Re": 88060, "f": 0.02228 } },
  "objective": null,
  "constraints": []
}
```

Rules:

- If `status` is not `converged`, `nodes` / `links` may be omitted or marked `usable: false`. Agents must not optimize on them.
- `warnings` are not failures. `status` is.
- Residual is the mass-imbalance norm used internally, not a pretty error.
- Do not change field names between versions without bumping `schemaVersion`.

---

## 4. Exit codes

| Code | Meaning | Agent action |
|---|---|---|
| 0 | Converged (and goldens passed, if that verb) | Read stdout |
| 2 | Invalid project / schema / missing link endpoint | Fix the JSON; do not retry the same file |
| 3 | Singular or missing pressure boundary | Add a `pFixed` or connect the island |
| 4 | Diverged or hit `max-iter` | Relax, check scales, or reduce step in an optimize loop |
| 5 | Constraint infeasible after size/optimize | Widen bounds or drop a constraint |
| 6 | Golden miss | Stop shipping; the engine regressed |

GUI wrappers must honor the same codes. Dogfood: a green canvas button that ignores exit code 4 is a bug.

---

## 5. How an agent should work a problem

Copy this loop. Do not skip steps 1–3 to look fast.

### 5.1 Understand the physical ask

Translate the user request into:

- fluid and state (P0 default: water 20 °C, $\rho=998.2$, $\mu=1.002\times10^{-3}$)
- boundary pressures / reservoir elevations
- devices that exist (pipes, pump curve, orifices, emitters)
- **objective** (one scalar)
- **constraints** (hard)
- **decision variables** and bounds

If the user said “make it better” and did not name an objective, stop and pick one from section 6. Do not invent three objectives and scalarize in secret.

### 5.2 Start from a file, not from vibes

Prefer, in order:

1. An existing `examples/*.hydroflow.json`
2. A project the user supplied
3. A new file that is a **minimal** edit of an example

Never emit a 40-component network on the first turn. MacroFlow papers all start with a coarse network and add fidelity.

### 5.3 Baseline solve

```text
hydroflow validate model.json
hydroflow solve model.json > baseline.json
```

Check `status`, residual, $\mathrm{Re}$ regime (laminar vs the 2300 switch), and mass balance at every junction. Record the baseline objective.

### 5.4 Mutate one family of variables

Change pipe diameters **or** orifice $K$ **or** pump speed, not all three at once on the first sweep. MF03 is the pattern: first enlarge the header, then size orifices.

```text
hydroflow sweep model.json --set link.header.geometry.D=0.02,0.03,0.04,0.05
```

Keep every trial JSON in a `runs/` folder. Agents forget what they tried; the filesystem must not.

### 5.5 Score, then search

```text
hydroflow score trial.json --spec spec.json
hydroflow optimize model.json --spec spec.json --max-evals 40
```

Stop when: constraint-feasible and objective improved less than a stated tolerance for $N$ evals, or `max-evals` hit. Write the winner back as a project file, not as a paragraph of numbers.

### 5.6 Explain with diffs, not adjectives

```text
hydroflow diff baseline.json winner.json
```

The agent’s user-facing answer should cite $\Delta Q$, $\Delta P$, and which decision variable moved. “The header is happier” is not an answer.

---

## 6. Optimization recipes (dogfood these)

Each recipe is a spec an agent should be able to run cold. Build them as `examples/` + `specs/` when code exists. Until then they are the acceptance stories for `optimize` / `size`.

### R1 Uniform laterals (MF03 header)

- **Given** seven identical branches off a header, fixed total $Q$.
- **Decision** header $D$.
- **Objective** minimize $\max Q_i / \min Q_i$.
- **Constraint** total $Q$ within 1 % of the specified supply.
- **Expect** larger $D$ lowers the ratio. If tees are modeled as plain junctions, say so; the paper needs tee inertia.

### R2 Orifice balance (MF03 / MF04)

- **Given** parallel loads that should not share flow equally.
- **Decision** branch orifice $K$ (or $D$).
- **Objective** minimize $\sum (Q_i - Q_{i,\mathrm{target}})^2$.
- **Constraint** $K \ge 0$, $D$ inside manufacture bounds.
- **Expect** high-load branches open, low-load branches throttle. Do not require $T_s$ until energy exists; flow targets are enough for P1.

### R3 Pump – system intersection (golden B)

- **Given** `examples/pump-loop.hydroflow.json`.
- **Decision** none for the baseline; then pipe $D$ or pump curve scale.
- **Objective** meet a target $Q$ at minimum shaft power $\rho g Q H / \eta$ when a pump efficiency is supplied; otherwise minimize $H$ at the operating $Q$.
- **Constraint** operating point on the supplied curve (no extrapolation past last tabulated $Q$).
- **Expect** golden $Q = 5.040585921353\times 10^{-3}\,\mathrm{m^3/s}$ at $H \approx 29.949\,\mathrm{m}$ for the stock file.

### R4 Emitter floor (irrigation)

- **Given** a lateral with $N$ emitters $Q = k P^{x}$, $x=0.5$, $k$ from golden D.
- **Decision** lateral $D$ and/or inlet $P$.
- **Objective** minimize pipe mass (or $D^2 L$) subject to every emitter $Q \ge Q_{\min}$.
- **Constraint** distal $P \ge 0$; no reverse emitters.
- **Expect** distal emitters are the binding constraint. Enlarging $D$ flattens the $Q$ profile.

### R5 Fan / pump fail (MF08)

- **Given** $N$ parallel movers.
- **Decision** which movers are on (binary).
- **Objective** maximize surviving useful $Q$ under single-fail.
- **Constraint** remaining movers stay on-curve; warn near stall.
- **Expect** total $Q$ drops when one unit is removed; the tool must not crash.

### R6 Bypass trade (MF09)

- **Given** a device path in parallel with a clearance path, fixed total $Q$.
- **Decision** bypass area / $K$.
- **Objective** maximize flow fraction through the device.
- **Expect** monotonic: more clearance → less device flow. Trend test, not 1 % golden.

### R7 Composite reduction (MF11)

- **Given** a detailed branch.
- **Action** `solve` the branch over a $Q$ grid, write a $\Delta p(Q)$ table, replace the subgraph with `generic-resistance` / `curve`.
- **Expect** the parent network using the table matches the detailed branch $\Delta p$ within the table tolerance. This is how agents keep models small.

Agents should refuse multi-objective soup (“cheapest and most uniform and quietest”) unless the spec writes an explicit weighted sum or a lexicographic order.

---

## 7. Best practices (print this next to the CLI)

1. **Trust status, not plots.** An unconverged field is not data.
2. **Elevation once.** Example `pFixed` already includes $P_\mathrm{atm}+\rho g z$. Do not add $\rho g\Delta z$ on links. Driving $\Delta p$ on golden A is $146834.97\,\mathrm{Pa}$.
3. **One change per sweep** until the baseline is understood.
4. **Bounds on every decision variable.** Unbounded $D$ → infinite header, trivial uniformity, useless answer.
5. **Stay on the pump curve.** Extrapolating $H=30-2000Q^2$ past the last table point is a warning in P0 and an error in optimize.
6. **Report $\mathrm{Re}$.** If a “turbulent” pipe is at $\mathrm{Re}=800$, the model is lying about $f$.
7. **Density is an input.** MF06 was at 5000 ft. Do not hard-code sea-level air for electronics cases.
8. **Cite the file.** Every claim a agent makes should point at a project path + result JSON, not at a remembered number.
9. **Do not scrape vendor catalogs** (Lytron, Comair-Rotron, Entegris, …). Import a user curve or a handbook $K$.
10. **Do not claim chip temperatures.** FNM bulk $T$ / $T_s$ from $R_\mathrm{th}$ is not a junction map.
11. **Keep trials.** `runs/<timestamp>-<objective>.json` is part of the answer.
12. **Goldens before heroics.** If `hydroflow goldens` fails, stop optimizing user networks.

---

## 8. Dogfood approach

Dogfood means **this repo uses Hydro-Flow the way agents will**.

### 8.1 Rituals for humans working on the engine

| When | Do |
|---|---|
| Before a PR merges | `hydroflow goldens` exit 0 |
| After changing friction, pumps, or hydrostatics | re-solve A–D and paste the result JSON in the PR |
| After adding a component | add a recipe in §6 or a verification case, then run it from the CLI — not only from a unit test import |
| After touching schema | `hydroflow validate` on every file in `examples/` |
| Weekly, once optimize exists | an agent (or a teammate acting as one) must complete R1 or R4 from a clean shell and attach the `runs/` folder |

If a feature is only reachable from the canvas, it does not exist for agents. Either add the verb or drop the feature from “core.”

### 8.2 Rituals for agents using the tool

- Start every session with `hydroflow goldens` when the binary is local. If goldens fail, tell the user the instrument is broken.
- Prefer editing JSON over generating a new topology when a close example exists.
- After at most ten failed solves (`status` not converged), stop and inspect topology. Do not spend the context window on a singular network.
- When proposing a “better” design, attach: baseline score, winner score, decision-variable table, `diff` output.
- If the user’s goal needs energy / tees / transients that the installed CLI does not have, say the phase gap. Do not fake $T_s$ from a flow-only solve.

### 8.3 Dogfood datasets

These files are both tests and agent homework:

| File | Homework |
|---|---|
| `examples/series-pipes.hydroflow.json` | Reproduce golden A; then sweep $D$ on pipe-2 |
| `examples/pump-loop.hydroflow.json` | Reproduce golden B; then size $D$ for a stated $Q$ |
| `examples/parallel-pipes.hydroflow.json` | Confirm equal split; then unbalance $K$ and recover it with `size` |
| Golden D emitter constants | Build a 10-emitter lateral and run R4 |

Paper cases S1–S7 in `docs/WORKFLOWS_AND_ACCEPTANCE.md` become dogfood the moment they exist as JSON. An agent that cannot run S1 from the CLI is not ready to advise on manifolds.

### 8.4 Self-host the spec

The project file schema is the API. Agents should load `docs/schema/hydroflow.project.schema.json` rather than guessing keys. When the schema changes, bump `schemaVersion` and keep a reader for `0.1.0` until examples migrate. Silent key renames poison every agent prompt that memorized the old shape.

---

## 9. Suggested function-calling shape

For MCP / tool-calling wrappers, expose **few** tools with **wide** JSON arguments, not one tool per component.

1. `hydroflow_validate(project | path)`
2. `hydroflow_solve(project | path)`
3. `hydroflow_sweep(project, path, values[])`
4. `hydroflow_optimize(project, spec)`
5. `hydroflow_goldens()`

Do not expose `set_pipe_diameter` as its own tool. Agents already edit JSON. The scarce resource is a trustworthy solve.

`spec` for optimize:

```text
{
  "objective": { "type": "minimize", "expr": "maxQ/minQ", "links": ["lat-1", "lat-2"] },
  "variables": [
    { "path": "links[id=header].component.geometry.D", "min": 0.02, "max": 0.08 }
  ],
  "constraints": [
    { "type": "sumQ", "equals": 0.000315, "relTol": 0.01 }
  ],
  "maxEvals": 40
}
```

Expressions should stay on a short allow-list (`sumQ`, `maxQ/minQ`, `pumpPower`, `minEmitterQ`, `maxAbsResidual`). Do not eval arbitrary Python from the spec.

---

## 10. Anti-patterns

- Running 200 random networks because search is cheap. FNM is cheap; **lying correlations** are not. Bound the search.
- Treating CFM tables from MF06/MF08 as 1 % goldens. Those papers are a 10–18 % hardware band.
- Optimizing display units. Change meters, not inches, internally.
- “Converged enough.” If `max-iter` fired, it is not converged.
- Building a second ad-hoc solver in the agent prompt (“I integrated Darcy by hand”). Call the CLI.
- Dropping gravity on a vertical irrigation main because the GUI example was drawn flat. Convention A still needs the correct `pFixed`.
- Shipping a GUI demo and calling the CLI “later.” Later never comes. P1 acceptance in the workflows doc already requires opening the series-pipes file; the CLI must do that first.

---

## 11. Phase gates for the agent surface

| Phase | Agent can |
|---|---|
| P0 | `validate`, `solve`, `goldens` on A–D |
| P1 | `diff`, `sweep`, `score`; editor is optional |
| P2 | `size`, `optimize` on R1–R4; curve import |
| P3 | R5–R7, irrigation pack, transient score |
| P4 | remote/headless API with the same JSON |

P0 is not done when a human can click Solve. P0 is done when an agent can run `hydroflow goldens && hydroflow solve examples/series-pipes.hydroflow.json` and get $Q$ within 1 % without opening a browser.

---

## 12. Related docs

- `docs/MACROFLOW_RESEARCH.md` — what MacroFlow is
- `docs/WORKFLOWS_AND_ACCEPTANCE.md` — W1–W15, U/I/E/S tests, phases
- `docs/VERIFICATION_CASES.md` — paper-derived cases and accuracy policy
- `docs/schema/hydroflow.project.schema.json` — project API
- `tests/fixtures/README.md` — hydrostatic Convention A
