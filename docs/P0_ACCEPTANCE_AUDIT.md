# P0 acceptance audit (ORN-24)

Maps every P0-required test ID from `docs/WORKFLOWS_AND_ACCEPTANCE.md` §4–§6 / §8 to the current suite.

**Verdict: P0 is not done under WORKFLOWS §8.** Goldens A–D within 1% on Q (AGENTS.md bar) are green and necessary, but not sufficient for the workflows checklist.

**Follow-ups:** ORN-45 (U-suite), ORN-46 (I4–I6), ORN-47 (editor E1/E2/E5/E8 + U19/U20), ORN-48 (U12/U15).

**ID collision:** some tests reuse U/I/E labels from `docs/VERIFICATION_CASES.md` with different numbering. The table below uses WORKFLOWS IDs only.

**Hydrostatic drift:** `tests/fixtures/README.md` and examples store `pFixed = Patm` and apply `ρ g Δz` from node `z`. WORKFLOWS §2.2 / U18 / E2 still describe the older encoding (`pFixed` includes elevation; E2 mid ≈ 261.6 kPa). Current Golden A mid-node P is **139210.69 Pa**.

---

## Coverage table

| Test ID | Required behavior | Status | Evidence |
|---|---|---|---|
| U1 | Laminar `f` at Re=1000 equals 0.064 | COVERED | `tests/friction.test.ts` Hagen–Poiseuille |
| U2 | Churchill `f` at Golden A Re/ε/D ≈ 0.022280 | COVERED | `tests/goldens.test.ts` A `pipe-1.f`; `tests/hydraulics.test.ts` Swamee–Jain check |
| U3 | Re from Golden A Q, D ≈ 88060 | COVERED | `tests/goldens.test.ts` A `pipe-1.Re` |
| U4 | Area at D=0.05 is πD²/4 | COVERED | Locked via Golden A V; `areaFromD` in hydraulics |
| U5 | Water ρ=998.2, μ=1.002e-3 | PARTIAL | Values in `fluids.ts` / examples / goldens assumptions; no constant assert |
| U6 | Series pipe-1 Δp ≈ 35531.80 Pa | PARTIAL | `tests/linkParts.test.ts` loss vs reference; exact Pa not in `goldens.json` |
| U7 | Series pipe-2 Δp ≈ 111303.18 Pa | PARTIAL | Same as U6 for pipe-2 |
| U8 | Invert U6 Δp recovers Q within 1% | GAP | No isolated Δp→Q invert test |
| U9 | Negative Δp flips Q sign | PARTIAL | Valve oddness in hydraulics; no reverse invert |
| U10 | Tiny Δp / Q→0: no NaN; Jacobian regularized | PARTIAL | Floor in `constitutive.ts`; hydrostatic Q≈0 converges; no tiny-Δp assert |
| U11 | Pump H=30−2000Q² at Golden B Q → H≈29.949 m | COVERED | `tests/goldens.test.ts` B-pump-loop |
| U12 | Sampled H(Q) table interpolates to same H | GAP | Polynomial coeffs only; no table interpolator |
| U13 | Emitter k from 2.0 L/h @ 100 kPa, x=0.5 | COVERED | `tests/emitter.test.ts`; Golden D |
| U14 | That k at 150 kPa → Q=6.804e-7 m³/s | COVERED | emitter + goldens D |
| U15 | P_up < P_dn → Q=0 | GAP | Current emitter is odd in Q; contradicts one-way spec |
| U16 | Two identical pipes in series: mid P splits frictional drop | GAP | Golden A uses unequal pipes |
| U17 | Two identical pipes in parallel (Golden C) | COVERED | goldens C + hydraulics parallel split |
| U18 | pFixed as-is matches Golden A; adding ρgΔz must fail | PARTIAL | Physics flipped to Patm + node z; equivalent no-double-count locked differently |
| U19 | Missing pressure BC → singular / warning | GAP | `assemble()` throws; UI catches; no test; not `status: singular` |
| U20 | Disconnected node → warning | GAP | No detection in `solveSteady` |
| I1 | series-pipes → Case A Q, P_mid, both pipe Δp | PARTIAL | Q + P_mid covered; link Δp not in goldens |
| I2 | pump-loop → Case B Q and pump H | COVERED | goldens B |
| I3 | parallel-pipes → Case C branch + total Q | COVERED | goldens C |
| I4 | Missing version/fluids/nodes/links rejected | PARTIAL | Schema requires fields; no reject fixture in CI |
| I5 | Parse → serialize → parse equals semantic fields | GAP | No Project round-trip test |
| I6 | Display units do not change stored SI Q | GAP | No unit toggle; formatters hardcoded |
| E1 | Load series-pipes: 3 nodes, 2 pipes, names visible | PARTIAL | Catalog load works; File→Open of `.hydroflow.json` expects `edges` not `links` |
| E2 | Solve overlay: mid ≈ 261.6 kPa; links Q≈3.47 L/s | GAP | No pressure overlay; E2 kPa target stale vs Golden A 139.21 kPa |
| E5 | Save/reload graph + last results | GAP | Save is diagram JSON only; no results block |
| E8 | Delete only BC, Solve → visible error, canvas kept | PARTIAL | Implemented via throw→error pill; no automated test |

### P0 components

| Component | Status | Notes |
|---|---|---|
| Pipe | COVERED | Goldens A–C |
| Junction | COVERED | Golden A mid |
| Pressure boundary | COVERED | All P0 examples |
| Pump curve | PARTIAL | Polynomial covered; table GAP (U12) |
| Orifice / valve K | COVERED | hydraulics valve; orifice in schema/UI |
| Emitter | PARTIAL | Engine + Golden D; no palette/inspector kind |

---

## Counts

| Status | U/I/E (30) | Components (6) |
|---|---|---|
| COVERED | 10 | 4 |
| PARTIAL | 10 | 2 |
| GAP | 10 | 0 |

---

## What is already solid

- Goldens A–D (and DLC) solve within 1% on Q (`tests/goldens.test.ts`)
- I2 / I3 complete
- Pipe / junction / boundary / valve-K / polynomial pump / emitter engine paths exist
- Energy / compressible / particle animation correctly out of P0 scope

---

## Related

- `docs/WORKFLOWS_AND_ACCEPTANCE.md` — source checklist
- `docs/VERIFICATION_CASES.md` — separate ID scheme (do not conflate)
- `tests/fixtures/goldens.json` — AGENTS.md 1% Q gate
