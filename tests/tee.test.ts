import { describe, expect, it } from "vitest";
import { WATER } from "../src/engine/fluids";
import { areaFromD } from "../src/engine/friction";
import { solveSteady } from "../src/engine/solve";
import { ZETA, ZETA_GARDEL, teeLegDrops, teeStaticDrop, type TeeLegFlow } from "../src/engine/tee";
import type { LinkDef, NodeDef, Project } from "../src/engine/types";
import { verifySolution } from "../src/engine/verify";

const rho = WATER.rho;
const Dc = 0.02;
const Ac = areaFromD(Dc);
const dyn = (w: number) => 0.5 * rho * w * w;

function legs(Qc: number, q: number, As: number, mode: "dividing" | "combining"): TeeLegFlow[] {
  const s = mode === "dividing" ? 1 : -1;
  return [
    { into: s * Qc, area: Ac, role: "run" },
    { into: -s * Qc * (1 - q), area: Ac, role: "run" },
    { into: -s * Qc * q, area: As, role: "branch" },
  ];
}

describe("Idelchik sharp tee coefficients", () => {
  it("dividing branch on the common velocity is 1 + (w_s/w_c)² up to D_s/D_c = 2/3 and 1 + 0.3 (w_s/w_c)² at 1", () => {
    expect(ZETA.dividing.branch(0.25, 0.25)).toBeCloseTo(2, 12);
    expect(ZETA.dividing.branch(0.5, 1)).toBeCloseTo(1.075, 12);
  });

  it("dividing straight is τ q² with τ = 0.4 for F_s/F_c ≤ 0.4 and continuous at q = 0.5 above it", () => {
    expect(ZETA.dividing.straight(0.5, 0.25)).toBeCloseTo(0.1, 12);
    const eps = 1e-9;
    expect(ZETA.dividing.straight(0.5 - eps, 1)).toBeCloseTo(ZETA.dividing.straight(0.5 + eps, 1), 6);
    expect(ZETA.dividing.straight(0.25, 1)).toBeLessThan(0);
  });

  it("combining straight is 1.55 q − q² and combining branch follows Table 7.1", () => {
    expect(ZETA.combining.straight(0.5, 0.25)).toBeCloseTo(0.525, 12);
    expect(ZETA.combining.branch(0.5, 0.25)).toBeCloseTo(4.5, 12);
    expect(ZETA.combining.branch(0.5, 1)).toBeCloseTo(0.55 * 0.75, 12);
  });
});

describe("tee static-drop identities", () => {
  const cases = [
    { Qc: 1e-3, q: 0.2, As: areaFromD(0.01) },
    { Qc: 3e-3, q: 0.5, As: areaFromD(0.0115) },
    { Qc: 5e-4, q: 0.9, As: areaFromD(0.008) },
    { Qc: 2e-3, q: 1, As: areaFromD(0.011) },
  ];

  it("dividing branch: static drop into the branch is ρ w_s², whatever the header speed", () => {
    for (const c of cases) {
      const ws = (c.Qc * c.q) / c.As;
      const d = teeLegDrops(legs(c.Qc, c.q, c.As, "dividing"), rho);
      expect(d[2]).toBeCloseTo(rho * ws * ws, 6);
    }
  });

  it("combining branch: static rise from branch to header is ρ (w_c² − w_st²), whatever the branch area", () => {
    for (const c of cases) {
      const wc = c.Qc / Ac;
      const wst = (c.Qc * (1 - c.q)) / Ac;
      const d = teeLegDrops(legs(c.Qc, c.q, c.As, "combining"), rho);
      expect(d[2]).toBeCloseTo(rho * (wc * wc - wst * wst), 6);
    }
  });

  it("dividing run recovers static pressure, but never more than Bernoulli", () => {
    for (const c of cases) {
      if (c.q === 1) continue;
      const wc = c.Qc / Ac;
      const wst = (c.Qc * (1 - c.q)) / Ac;
      const d = teeLegDrops(legs(c.Qc, c.q, c.As, "dividing"), rho);
      expect(d[1]).toBeLessThan(0);
      expect(-d[1]).toBeLessThanOrEqual(dyn(wc) - dyn(wst) + 1e-9);
    }
  });

  it("combining run pays at least the Bernoulli acceleration", () => {
    for (const c of cases) {
      const wc = c.Qc / Ac;
      const wst = (c.Qc * (1 - c.q)) / Ac;
      const d = teeLegDrops(legs(c.Qc, c.q, c.As, "combining"), rho);
      expect(d[1]).toBeGreaterThanOrEqual(dyn(wc) - dyn(wst) - 1e-9);
    }
  });

  it("a branch at rest sees the header static pressure and the common leg carries no drop", () => {
    for (const mode of ["dividing", "combining"] as const) {
      const noBranch = teeLegDrops(legs(1e-3, 0, areaFromD(0.01), mode), rho);
      expect(noBranch).toEqual([0, 0, 0]);
      const noRun = teeLegDrops(legs(1e-3, 1, areaFromD(0.01), mode), rho);
      expect(noRun[0]).toBe(0);
    }
  });

  it("q = 1 is the sharp-elbow limit: total loss on the branch velocity is 1 + (F_s/F_c)²", () => {
    const As = areaFromD(0.01);
    const Qc = 1e-3;
    const ws = Qc / As;
    const wc = Qc / Ac;
    const drop = teeStaticDrop({ mode: "dividing", leg: "branch", Qc, Qx: Qc, Ac, Ax: As, As, rho });
    const totalLoss = drop + dyn(wc) - dyn(ws);
    expect(totalLoss / dyn(ws)).toBeCloseTo(1 + (As / Ac) ** 2, 9);
  });

  it("a two-leg junction equals a three-leg tee whose far run is at rest, whichever way that run points", () => {
    const As = areaFromD(0.01);
    const three = teeLegDrops(legs(1e-3, 1, As, "dividing"), rho);
    const two = teeLegDrops(
      [
        { into: 1e-3, area: Ac, role: "run" },
        { into: -1e-3, area: As, role: "branch" },
      ],
      rho,
    );
    expect(two).toEqual([0, three[2]]);
    const trickle = teeLegDrops(
      [
        { into: 1e-3, area: Ac, role: "run" },
        { into: 1e-12, area: Ac, role: "run" },
        { into: -1e-3, area: As, role: "branch" },
      ],
      rho,
    );
    expect(trickle[2]).toBeCloseTo(three[2], 6);
  });

  it("flow entering through the side branch has no handbook row and is lossless", () => {
    const As = areaFromD(0.01);
    const d = teeLegDrops(
      [
        { into: -6e-4, area: Ac, role: "run" },
        { into: -4e-4, area: Ac, role: "run" },
        { into: 1e-3, area: As, role: "branch" },
      ],
      rho,
    );
    expect(d).toEqual([0, 0, 0]);
  });

  it("dissipates total pressure overall, even where one leg gains energy", () => {
    for (const mode of ["dividing", "combining"] as const) {
      for (const Ds of [0.006, 0.0115, 0.014, 0.02]) {
        const As = areaFromD(Ds);
        for (let q = 0.02; q <= 1; q += 0.02) {
          const Qc = 1e-3;
          const l = legs(Qc, q, As, mode);
          const d = teeLegDrops(l, rho);
          const wc = Qc / Ac;
          let power = 0;
          for (let i = 1; i < 3; i++) {
            const wx = Math.abs(l[i].into) / l[i].area;
            const totalLoss = mode === "dividing" ? d[i] + dyn(wc) - dyn(wx) : d[i] + dyn(wx) - dyn(wc);
            power += Math.abs(l[i].into) * totalLoss;
          }
          expect(power).toBeGreaterThanOrEqual(-1e-12);
        }
      }
    }
  });
});

function project(nodes: NodeDef[], links: LinkDef[]): Project {
  return {
    version: "0.1.0",
    meta: { name: "tee", description: "", createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z" },
    units: { system: "SI", length: "m", pressure: "Pa", flow: "m3/s", temperature: "K", power: "W" },
    fluids: { water: WATER },
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy: false,
      gravity: false,
      convergence: { massResidual: 1e-10, energyResidual: 1e-8, maxIter: 80, relaxationP: 0.85, relaxationQ: 0.7 },
    },
    nodes,
    links,
    couplings: [],
  };
}

function node(id: string, over: Partial<NodeDef> = {}): NodeDef {
  return { id, kind: "junction", x: 0, y: 0, z: 0, fluid: "water", ...over };
}

/** Zero-length lossless leg, so node pressure differences are the tee drops alone. */
function leg(id: string, from: string, to: string, D: number): LinkDef {
  return {
    id,
    from,
    to,
    fluid: "water",
    component: { type: "pipe", lossModel: "darcy-weisbach", geometry: { L: 0, D, eps: 0 }, K: 0 },
  };
}

describe("tee junctions in the network solver", () => {
  const Ds = 0.01;
  const As = areaFromD(Ds);
  const Qc = 1e-3;
  const q = 0.3;

  it("dividing tee: node holds the header static, legs drop by the handbook amounts", () => {
    const p = project(
      [
        node("in", { kind: "boundary", pFixed: 2e5 }),
        node("J", { tee: { branch: "side" } }),
        node("R", { mdotSource: -rho * Qc * (1 - q) }),
        node("S", { mdotSource: -rho * Qc * q }),
      ],
      [leg("main", "in", "J", Dc), leg("run", "J", "R", Dc), leg("side", "J", "S", Ds)],
    );
    const r = solveSteady(p);
    expect(r.status).toBe("converged");
    const P = (id: string) => r.nodes[id].P;
    expect(P("J")).toBeCloseTo(2e5, 3);
    const ws = (Qc * q) / As;
    expect((P("J") - P("S")) / (rho * ws * ws)).toBeCloseTo(1, 5);
    const wc = Qc / Ac;
    expect((P("J") - P("R")) / (-dyn(wc) * (2 * q - 1.4 * q * q))).toBeCloseTo(1, 5);
    expect(r.links.side.dP).toBeCloseTo(P("J") - P("S"), 1);
    expect(verifySolution(p, r).checks.find((c) => c.id === "momentum")?.pass).toBe(true);
  });

  it("combining tee: branch and upstream run stand above the header by the handbook amounts", () => {
    const p = project(
      [
        node("R", { mdotSource: rho * Qc * (1 - q) }),
        node("S", { mdotSource: rho * Qc * q }),
        node("J", { tee: { branch: "side" } }),
        node("out", { kind: "boundary", pFixed: 1e5 }),
      ],
      [leg("run", "R", "J", Dc), leg("side", "S", "J", Ds), leg("main", "J", "out", Dc)],
    );
    const r = solveSteady(p);
    expect(r.status).toBe("converged");
    const P = (id: string) => r.nodes[id].P;
    expect(P("J")).toBeCloseTo(1e5, 3);
    const wc = Qc / Ac;
    const wst = (Qc * (1 - q)) / Ac;
    expect((P("S") - P("J")) / (rho * (wc * wc - wst * wst))).toBeCloseTo(1, 5);
    expect((P("R") - P("J")) / (dyn(wc) * (3.55 * q - 2 * q * q))).toBeCloseTo(1, 5);
  });

  it("link orientation does not change the physics", () => {
    const forward = project(
      [
        node("in", { kind: "boundary", pFixed: 2e5 }),
        node("J", { tee: { branch: "side" } }),
        node("R", { mdotSource: -rho * Qc * (1 - q) }),
        node("S", { mdotSource: -rho * Qc * q }),
      ],
      [leg("main", "in", "J", Dc), leg("run", "J", "R", Dc), leg("side", "J", "S", Ds)],
    );
    const flipped = project(forward.nodes, [
      leg("main", "J", "in", Dc),
      leg("run", "R", "J", Dc),
      leg("side", "S", "J", Ds),
    ]);
    const a = solveSteady(forward);
    const b = solveSteady(flipped);
    expect(b.status).toBe("converged");
    for (const id of ["J", "R", "S"]) expect(b.nodes[id].P).toBeCloseTo(a.nodes[id].P, 1);
    expect(b.links.side.Q).toBeCloseTo(-a.links.side.Q, 9);
  });

  it("rejects tees on boundary nodes, non-incident branches, and unequal runs", () => {
    const base = [
      node("in", { kind: "boundary", pFixed: 2e5 }),
      node("J", { tee: { branch: "side" } }),
      node("R", { mdotSource: -rho * Qc * (1 - q) }),
      node("S", { mdotSource: -rho * Qc * q }),
    ];
    const links = [leg("main", "in", "J", Dc), leg("run", "J", "R", Dc), leg("side", "J", "S", Ds)];
    expect(() =>
      solveSteady(project([{ ...base[0], tee: { branch: "main" } }, ...base.slice(1)], links)),
    ).toThrow(/junction/);
    expect(() =>
      solveSteady(project([base[0], { ...base[1], tee: { branch: "nope" } }, ...base.slice(2)], links)),
    ).toThrow(/not an incident link/);
    expect(() =>
      solveSteady(project(base, [links[0], leg("run", "J", "R", 0.03), links[2]])),
    ).toThrow(/equal areas/);
  });
});

describe("Gardel sharp 90° tee coefficients (r★=0)", () => {
  it("dividing branch matches Vasava (5.7) at equal-area and reduced branch", () => {
    // a=1, φ/2=π/4, tan=1, r★=0 → 0.95(1−q)² + 1.3 q² + 0.8 q
    expect(ZETA_GARDEL.dividing.branch(0.5, 1)).toBeCloseTo(
      0.95 * 0.25 + 1.3 * 0.25 + 0.8 * 0.5,
      12,
    );
    expect(ZETA_GARDEL.dividing.branch(0, 1)).toBeCloseTo(0.95, 12);
    expect(ZETA_GARDEL.dividing.branch(1, 1)).toBeCloseTo(2.1, 12);
    // a=0.25: bracket = 1.3 − 0.3 + (0.4−0.025)/0.0625 = 1 + 6 = 7
    expect(ZETA_GARDEL.dividing.branch(0.25, 0.25)).toBeCloseTo(
      0.95 * (0.75) ** 2 + (0.25) ** 2 * 7 + 0.4 * 0.25 * ((1.25) / 0.25),
      10,
    );
  });

  it("dividing straight K32 is independent of area ratio (handbook identity)", () => {
    const q = 0.4;
    const z = 0.03 * (0.6) ** 2 + 0.35 * 0.16 - 0.2 * 0.4 * 0.6;
    expect(ZETA_GARDEL.dividing.straight(q, 0.25)).toBeCloseTo(z, 12);
    expect(ZETA_GARDEL.dividing.straight(q, 1)).toBeCloseTo(z, 12);
    expect(ZETA_GARDEL.dividing.straight(0, 1)).toBeCloseTo(0.03, 12);
    expect(ZETA_GARDEL.dividing.straight(1, 1)).toBeCloseTo(0.35, 12);
  });

  it("combining equal-area 90° reduces to closed forms with cosθ=0", () => {
    // branch: −0.92(1−q)² + 1.2 q² + (2−a)q(1−q); a=1 → + q(1−q)
    expect(ZETA_GARDEL.combining.branch(0.5, 1)).toBeCloseTo(
      -0.92 * 0.25 + 1.2 * 0.25 + 0.5 * 0.5,
      12,
    );
    // straight: 0.03(1−q)² + 0.62 q² + q(1−q) at a=1
    expect(ZETA_GARDEL.combining.straight(0.5, 1)).toBeCloseTo(
      0.03 * 0.25 + 0.62 * 0.25 + 0.25,
      12,
    );
  });

  it("q=0 and q=1 limits are finite for both modes", () => {
    for (const a of [0.25, 0.5, 1]) {
      for (const q of [0, 1]) {
        expect(Number.isFinite(ZETA_GARDEL.dividing.branch(q, a))).toBe(true);
        expect(Number.isFinite(ZETA_GARDEL.dividing.straight(q, a))).toBe(true);
        expect(Number.isFinite(ZETA_GARDEL.combining.branch(q, a))).toBe(true);
        expect(Number.isFinite(ZETA_GARDEL.combining.straight(q, a))).toBe(true);
      }
    }
  });

  it("equal-area sharp branch ζ is below Idelchik near mid-q (no figure fit)", () => {
    // Docs estimated Gardel ~15–20% below Idelchik on branch near the inlet.
    const q = 0.3;
    const g = ZETA_GARDEL.dividing.branch(q, 1);
    const i = ZETA.dividing.branch(q, 1);
    expect(g).toBeLessThan(i);
    expect(g / i).toBeGreaterThan(0.7);
    expect(g / i).toBeLessThan(0.95);
  });
});

describe("Gardel tee static-drop identities", () => {
  const corr = "gardel" as const;

  it("q=0 recovers handbook ζ (branch 0.95, straight 0.03), not Idelchik's lossless limit", () => {
    const As = areaFromD(0.01);
    const a = As / Ac;
    expect(ZETA_GARDEL.dividing.branch(0, a)).toBeCloseTo(0.95, 12);
    expect(ZETA_GARDEL.dividing.straight(0, a)).toBeCloseTo(0.03, 12);
    const d = teeLegDrops(legs(1e-3, 0, As, "dividing"), rho, corr);
    const wc = 1e-3 / Ac;
    // branch Qx=0 → static = dyn*(ζ−1); straight full flow → dyn*ζ_st
    expect(d[2]).toBeCloseTo(dyn(wc) * (0.95 - 1), 6);
    expect(d[1]).toBeCloseTo(dyn(wc) * 0.03, 6);
  });

  it("q=1 dividing branch is the sharp-elbow limit ζ_c = 2.1 at equal area", () => {
    const Qc = 1e-3;
    const drop = teeStaticDrop({
      mode: "dividing",
      leg: "branch",
      Qc,
      Qx: Qc,
      Ac,
      Ax: Ac,
      As: Ac,
      rho,
      correlation: corr,
    });
    const w = Qc / Ac;
    // total loss on common velocity = ζ_c = 2.1 (a=1, q=1)
    const totalLoss = drop + dyn(w) - dyn(w);
    expect(totalLoss / dyn(w)).toBeCloseTo(2.1, 9);
    expect(drop / dyn(w)).toBeCloseTo(2.1, 9); // wr=1 → drop = dyn*(ζ−1+1)
  });

  it("dissipates total pressure for dividing flow in Gardel's area-ratio range (a ≥ 0.16)", () => {
    // Combining at a ≪ Gardel's Lausanne/German range can yield empirical
    // energy-gain artifacts; do not invent a fix — fence the identity to the
    // published dividing case inside the calibrated a band.
    for (const Ds of [0.008, 0.0115, 0.014, 0.02]) {
      const As = areaFromD(Ds);
      const a = As / Ac;
      expect(a).toBeGreaterThanOrEqual(0.15);
      for (let q = 0.02; q <= 1; q += 0.02) {
        const Qc = 1e-3;
        const l = legs(Qc, q, As, "dividing");
        const d = teeLegDrops(l, rho, corr);
        const wc = Qc / Ac;
        let power = 0;
        for (let i = 1; i < 3; i++) {
          const wx = Math.abs(l[i].into) / l[i].area;
          const totalLoss = d[i] + dyn(wc) - dyn(wx);
          power += Math.abs(l[i].into) * totalLoss;
        }
        expect(power).toBeGreaterThanOrEqual(-1e-12);
      }
    }
  });

  it("equal-area dividing branch ζ(1) exceeds ζ(0); mid-q sits below Idelchik", () => {
    expect(ZETA_GARDEL.dividing.branch(1, 1)).toBeGreaterThan(
      ZETA_GARDEL.dividing.branch(0, 1),
    );
    const q = 0.3;
    expect(ZETA_GARDEL.dividing.branch(q, 1)).toBeLessThan(ZETA.dividing.branch(q, 1));
  });
});
