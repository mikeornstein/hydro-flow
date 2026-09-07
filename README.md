# hydro-flow

Web clone of the core functionality of [MacroFlow](https://inresllc.com/macroflow-overview.html) — a Flow Network Modeling (FNM) tool for rapid flow and thermal design of engineering systems.

## Research

See [docs/MACROFLOW_RESEARCH.md](docs/MACROFLOW_RESEARCH.md) for the full product-research report covering methodology, solver, component library, UI, competitors, data model, and a phased MVP plan for this repo.

## Status

Research complete. The **P0** slice from the research plan is scaffolded and runnable:
a TypeScript FNM solver, a Vite + React + XYFlow canvas, and a JSON schema.

## Layout

| Path | Contents |
| --- | --- |
| `packages/solver` | Steady incompressible FNM solver (nodal Newton / Global-Gradient), Darcy–Weisbach + Swamee–Jain friction, minor losses, pump curves, elevation. Vitest verification suite. |
| `apps/web` | Vite + React + [XYFlow](https://reactflow.dev/) canvas that loads a network, runs the solver in a Web Worker, and overlays pressures and flows. |
| `schema/hydroflow.schema.json` | JSON Schema for the v0.1 project document (research §11). |

## Getting started

Requires Node.js >= 20.

```bash
npm install                 # install workspaces
npm run build --workspace @hydro-flow/solver   # build solver (needed by the web app)
npm test                    # run the solver verification suite
npm run dev                 # start the web app at http://localhost:5173
```

The solver's `test/solver.test.ts` implements the verification cases from the
research report (§13): laminar/turbulent single pipe, series, parallel,
hydrostatic, three-node loop continuity, and the P0 pump-lift acceptance case.
