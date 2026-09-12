# hydro-flow

Browser **flow-network modeling** for thermal-hydraulic systems. A physical plant is a graph: junctions hold pressure and temperature, components hold a constitutive ΔP(Q) and optional heat transfer. The engine solves discrete mass, momentum, and energy — not 3-D CFD. A live build is at https://mikeornstein.com/hydro-flow/.

## Docs

- [docs/MACROFLOW_RESEARCH.md](docs/MACROFLOW_RESEARCH.md) — product research
- [docs/WORKFLOWS_AND_ACCEPTANCE.md](docs/WORKFLOWS_AND_ACCEPTANCE.md) — user workflows
- [docs/VERIFICATION_CASES.md](docs/VERIFICATION_CASES.md) — test catalog
- [docs/P0_ACCEPTANCE_AUDIT.md](docs/P0_ACCEPTANCE_AUDIT.md) — WORKFLOWS §8 P0 coverage map
- [docs/schema/hydroflow.project.schema.json](docs/schema/hydroflow.project.schema.json) — `.hydroflow.json` schema
- [AGENTS.md](AGENTS.md) — agent contract
- [CONTRIBUTING.md](CONTRIBUTING.md) — branching and pull-request rules

## Worked example

The default canvas project is a **DLC compute rack**: a closed water loop with a CDU pump, strainer, four GPU cold plates in parallel, and a forced-convection **air–liquid heat exchanger** with fans.

Steady-state identities the solver tests prove:

- HEX heat rejection = Σ GPU heat (2800 W)
- Loop ΔT = Q / (ṁ cp)
- Parallel branches split equally
- ε-NTU (crossflow, both unmixed) matches an independent evaluation
- Pump operating point lies on its catalog curve
- GPU case T = T_coolant,mean + q R_th

P0 golden fixtures (series, pump-loop, parallel) live in `examples/` and `tests/fixtures/goldens.json`.

## Run

```bash
npm install
npm run check
npm test
npm run dev
```

`npm run check` validates project JSON against the schema and confirms repo contract files. GitHub Actions runs it on every pull request. `npm test` runs the Vitest hydraulics and energy suite.

## Stack

- Engine: TypeScript Newton hydraulics + linear ε-NTU energy
- UI: Vite, React 19, XYFlow
- Tests: Vitest (hydraulics, energy, HEX, DLC example) plus schema goldens
- Internal units are SI. The canvas is schematic; elevation is a node property.
