# Open physics / UI decisions (ORN-37)

Written answers to `docs/WORKFLOWS_AND_ACCEPTANCE.md` §9. These lock product intent; implementation follow-ups are linked where work remains.

---

## 1. Node pressure is static

**Decision:** Node `P` is **static** absolute pressure (Pa). Hydro-Flow does not store stagnation pressure on nodes.

**Why:** P0 goldens and examples treat `pFixed` as absolute static pressure at the node elevation (`tests/fixtures/README.md`: `pFixed = Patm`, elevation via node `z`). Dynamic pressure `ρ V²/2` lives only inside link constitutive evaluations (Darcy / K / tee ζ), not as a node state.

**Follow-up:** None for P0. If a future feature needs stagnation heads (open-channel / pitot-style BCs), add an explicit optional field — do not reinterpret `P`.

---

## 2. Tee K: Idelchik (default) + optional Gardel

**Decision:** Keep the published subset already in `src/engine/tee.ts`.

| Correlation | Citations locked in code |
|---|---|
| `idelchik` (default) | Idelchik *Handbook of Hydraulic Resistance*, 4th ed. (2007), Ch.7 — Diagrams 7.18, 7.20 No.1, 7.4 + Table 7.1 |
| `gardel` | Gardel 1957 via Vasava LUT thesis §5.1–5.2; Blaisdell & Manson USDA TB 1283 (1963) |

ζ is a **total-pressure** loss coefficient on the common-channel velocity; the solver applies it as a static-pressure drop along each leg relative to the junction node (see `tee.ts` header and `teeStaticDrops`).

**Follow-up:** None for the citation lock. Elbow / sudden-expansion Idelchik charts remain P1+ handbook work (WORKFLOWS §7).

---

## 3. Reynolds transition: Churchill continuum (goldens-compatible)

**Decision:** Pipe friction uses **Churchill (1977)** for all Re (`src/engine/friction.ts`). There is **no** hard laminar/turbulent switch in the Darcy path.

WORKFLOWS §3.1 still writes the pedagogical 2300 / Swamee–Jain form. That remains a *teaching* formula; the engine of record is Churchill. Golden A’s `f` matches Churchill at Re≈88060.

MF08-style **K** interpolation between laminar and turbulent open-area plates is a separate constitutive choice for perforated screens, not a global Re switch. Do not add a 2300 hard cut to pipes.

**Follow-up:** Optionally clarify §3.1 to say “pedagogical; engine uses Churchill” (doc polish only).

---

## 4. Fan / pump stall and reverse: allow with floor, warn later

**Decision (current behavior, confirmed):**

- Forward Q: curve `polyval`, floored at `hMin` / `dpMin` (`src/engine/thermo.ts`).
- Reverse Q: shutoff head/rise plus a quadratic loss — **allowed**, not rejected.
- No dedicated “stall” warning yet; `SolveResult.warnings` exists for singular / max-iter / energy issues.

**Product intent:** Keep allowing off-curve / reverse so the Newton solve stays continuous (papers assume forward on-curve for *design*, not for solver hard-stops). Surface **warnings** when operating near stall or reverse once S5 (ORN-31) lands — warn, do not crash.

**Follow-up:** ORN-31 — S5 fan-fail acceptance + stall/reverse warnings.

---

## 5. Multiplicity: schema field before S6 (not only copied links)

**Decision:** Prefer an explicit link (or subgraph) **`multiplicity: N`** over requiring users to duplicate N identical branches for MF01-style “four identical card channels.”

Copied links remain valid for maldistribution studies (S6 hierarchical manifolds). Multiplicity is the lever for identical parallel passages with generous headers.

**Follow-up:** ORN-32 — schema + `types.ts` + MF01 example using the real lever.

---

## Summary

| # | Question | Decision | Follow-up |
|---|---|---|---|
| 1 | Static vs stagnation | Static absolute P | — |
| 2 | Tee K | Idelchik default + Gardel; citations in `tee.ts` | — |
| 3 | Re transition | Churchill all-Re; no 2300 hard cut | Optional §3.1 wording |
| 4 | Stall / reverse | Allow + floor; warn in S5 | ORN-31 |
| 5 | Multiplicity | Schema `multiplicity` | ORN-32 |
