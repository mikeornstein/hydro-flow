# hydro-flow

Browser **flow-network modeling** for thermal-hydraulic systems. A physical plant is a graph: junctions hold pressure and temperature, components hold a constitutive ΔP(Q) and optional heat transfer. The engine solves discrete mass, momentum, and energy — not 3-D CFD.

## Worked example

The default project is a **DLC compute rack**: a closed water loop with a CDU pump, strainer, four GPU cold plates in parallel, and a forced-convection **air–liquid heat exchanger** with fans.

Steady-state identity the tests prove:

- HEX heat rejection = Σ GPU heat (2800 W)
- Loop ΔT = Q / (ṁ cp)
- Parallel branches split equally
- ε-NTU (crossflow, both unmixed) matches an independent evaluation
- Pump operating point lies on its catalog curve
- GPU case T = T_coolant,mean + q R_th

## Run

```bash
npm install
npm test
npm run dev
```

## Stack

- Engine: TypeScript Newton hydraulics + linear ε-NTU energy
- UI: Vite, React 19, XYFlow
- Tests: Vitest (hydraulics, energy, HEX, DLC example)

Internal units are SI. The canvas is schematic; elevation is a node property.
