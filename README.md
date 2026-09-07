# hydro-flow

Web clone of the core functionality of [MacroFlow](https://inresllc.com/macroflow-overview.html) — a Flow Network Modeling (FNM) tool for rapid flow and thermal design of engineering systems.

## Research

See [docs/MACROFLOW_RESEARCH.md](docs/MACROFLOW_RESEARCH.md) for the product-research report. See [docs/WORKFLOWS_AND_ACCEPTANCE.md](docs/WORKFLOWS_AND_ACCEPTANCE.md) for the user workflows and [docs/VERIFICATION_CASES.md](docs/VERIFICATION_CASES.md) for the test catalog.

## Status

Research and the project schema are in. Example networks and P0 golden fixtures are in `examples/` and `tests/fixtures/`. The solver and web UI are not started.

## Checks

```bash
npm install
npm run check
```

GitHub Actions runs the same check on every pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for branching and pull-request rules. Agents start at [AGENTS.md](AGENTS.md).
