# hydro-flow

Web *and* CLI clone of the core functionality of [MacroFlow](https://inresllc.com/macroflow-overview.html) — a 1-D Flow Network Modeling (FNM) tool. Agents should optimize fluid systems from the command line. The canvas is a viewer of the same JSON files.

## Status

Docs for FNM physics, verification, and the agent CLI are on `main`. The solver binary is **not shipped yet**.

**P0 is not “a human clicked Solve.” P0 is:**

```bash
hydroflow goldens && hydroflow solve examples/series-pipes.hydroflow.json
```

both exit 0, and Q is within 1% of the analytic golden. No browser.

## Agent loop (dogfood this)

```
validate → solve → score → (whatif | optimize) → compare → write dogfood/
```

Unconverged solves are failed tool calls, not designs. Objectives are an allow-list. No `eval()`. SI stored. GUI and CLI share one project schema.

## Checks

Until `hydroflow` exists, the repo gate is:

```bash
npm install
npm run check
```

GitHub Actions runs the same command on every pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for branching and pull-request rules. Agents start at [AGENTS.md](AGENTS.md).

## Documentation

### Physics and product
- [Research teardown](docs/MACROFLOW_RESEARCH.md)
- [Workflows and acceptance](docs/WORKFLOWS_AND_ACCEPTANCE.md)
- [Verification cases](docs/VERIFICATION_CASES.md)
- Schema: [docs/schema/hydroflow.project.schema.json](docs/schema/hydroflow.project.schema.json)
- Goldens: [tests/fixtures/goldens.json](tests/fixtures/goldens.json)

### Agents, CLI, dogfood
- [Tool contract](docs/TOOL_CONTRACT.md) — verbs, exit codes, JSON envelopes, MCP tools, optimize schema, jobs D1–D7
- [Agent playbook](docs/AGENT_PLAYBOOK.md) — day-to-day loop, recipes, anti-patterns
- [Dogfood artifacts](dogfood/README.md) — where runs live once a CLI exists

## Examples

- [examples/series-pipes.hydroflow.json](examples/series-pipes.hydroflow.json)
- [examples/parallel-pipes.hydroflow.json](examples/parallel-pipes.hydroflow.json)
- [examples/pump-loop.hydroflow.json](examples/pump-loop.hydroflow.json)
