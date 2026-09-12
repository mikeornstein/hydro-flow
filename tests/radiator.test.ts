import { describe, expect, it } from "vitest";
import { Radiator } from "../src/engine/radiator";
import { solveSteady } from "../src/engine/solve";
import { epsilonNtu } from "../src/engine/thermo";
import { WATER } from "../src/engine/fluids";
import { P_ATM, type LinkDef, type Project } from "../src/engine/types";

const LAW = { ua: 180, tSink: 300 };
/** UA 180 W/K at C 360 W/K: NTU 0.5, ε = 1 − e^−0.5. */
const EPS_HALF = 1 - Math.exp(-0.5);

type Component = LinkDef["component"];

function link(component: Partial<Component> & Pick<Component, "type">): LinkDef {
  return {
    id: "L",
    from: "a",
    to: "b",
    fluid: WATER.id,
    component: {
      lossModel: "darcy-weisbach",
      geometry: { L: 1, D: 0.02, eps: 0 },
      K: 0,
      ...component,
    },
  };
}

describe("Radiator.conductance", () => {
  it("equals the ε-NTU primitive with C_cold = ∞, counterflow", () => {
    const C = 360;
    const k = Radiator.conductance(LAW, C);
    const e = epsilonNtu({
      UA: LAW.ua,
      C_hot: C,
      C_cold: Number.POSITIVE_INFINITY,
      arrangement: "counterflow",
    });
    expect(k.effectiveness).toBeCloseTo(e.effectiveness, 12);
    expect(k.ntu).toBeCloseTo(e.ntu, 12);
    expect(k.U).toBeCloseTo(e.effectiveness * C, 12);
  });

  it("ε = 1 − exp(−NTU): NTU 0.5 gives ε 0.39347 and U 141.649 W/K", () => {
    const k = Radiator.conductance(LAW, 360);
    expect(k.ntu).toBeCloseTo(0.5, 12);
    expect(k.effectiveness).toBeCloseTo(EPS_HALF, 12);
    expect(k.effectiveness).toBeCloseTo(0.39346934, 7);
    expect(k.U).toBeCloseTo(141.64896, 4);
  });

  it("stays finite at zero flow", () => {
    expect(Radiator.conductance(LAW, 0)).toEqual({ C: 0, ntu: 0, effectiveness: 0, U: 0 });
  });
});

describe("Radiator.evaluate", () => {
  it("q = ε C (T_in − tSink), T_out = (1 − ε) T_in + ε tSink", () => {
    const st = Radiator.evaluate(LAW, 360, 320);
    expect(st.q).toBeCloseTo(EPS_HALF * 360 * 20, 9);
    expect(st.q).toBeCloseTo(2832.979, 2);
    expect(st.T_out).toBeCloseTo((1 - EPS_HALF) * 320 + EPS_HALF * 300, 9);
    expect(st.T_out).toBeCloseTo(312.1306, 3);
    expect(st.T_in - st.T_out).toBeCloseTo(st.q / 360, 9);
  });

  it("warms the fluid when the sink is hotter than the inlet", () => {
    const st = Radiator.evaluate(LAW, 360, 290);
    expect(st.q).toBeCloseTo(-1416.49, 1);
    expect(st.T_out).toBeCloseTo(293.9347, 3);
  });

  it("passes the fluid through unchanged at zero flow", () => {
    expect(Radiator.evaluate(LAW, 0, 330)).toMatchObject({ q: 0, T_in: 330, T_out: 330, U: 0 });
  });
});

describe("Radiator.lawOf", () => {
  it("is null for a plain pipe and the law for a radiator", () => {
    expect(Radiator.lawOf(link({ type: "pipe" }))).toBeNull();
    expect(Radiator.lawOf(link({ type: "radiator", radiator: LAW }))).toEqual(LAW);
  });

  it("throws when type radiator has no law", () => {
    expect(() => Radiator.lawOf(link({ type: "radiator" }))).toThrow(/needs component\.radiator/);
  });

  it("throws when a law rides on a non-radiator type", () => {
    expect(() => Radiator.lawOf(link({ type: "pipe", radiator: LAW }))).toThrow(/needs type radiator/);
  });

  it("throws on ua ≤ 0 and tSink ≤ 0", () => {
    expect(() => Radiator.lawOf(link({ type: "radiator", radiator: { ua: 0, tSink: 300 } }))).toThrow(
      /ua must be > 0/,
    );
    expect(() => Radiator.lawOf(link({ type: "radiator", radiator: { ua: -5, tSink: 300 } }))).toThrow(
      /ua must be > 0/,
    );
    expect(() => Radiator.lawOf(link({ type: "radiator", radiator: { ua: 100, tSink: 0 } }))).toThrow(
      /tSink must be > 0/,
    );
  });

  it("throws when a radiator also carries a prescribed q", () => {
    expect(() => Radiator.lawOf(link({ type: "radiator", radiator: LAW, q: 500 }))).toThrow(
      /no prescribed q/,
    );
  });
});

describe("Radiator.index", () => {
  it("throws when a radiator link is also a HEX stream", () => {
    const project = {
      fluids: { [WATER.id]: WATER },
      links: [link({ type: "radiator", radiator: LAW }), { ...link({ type: "hex-stream" }), id: "cold" }],
      couplings: [
        {
          id: "hx",
          type: "hex" as const,
          hotLinkId: "L",
          coldLinkId: "cold",
          ua: 100,
          arrangement: "counterflow" as const,
        },
      ],
    };
    expect(() => Radiator.index(project, [1e-4, 1e-4])).toThrow(/HEX stream/);
  });

  it("keys radiator terms by link index with C = ρ |Q| cp", () => {
    const project = {
      fluids: { [WATER.id]: WATER },
      links: [link({ type: "pipe" }), { ...link({ type: "radiator", radiator: LAW }), id: "rad" }],
      couplings: [],
    };
    const terms = Radiator.index(project, [1e-4, -1e-4]);
    expect([...terms.keys()]).toEqual([1]);
    expect(terms.get(1)!.C).toBeCloseTo(417.44724, 4);
    expect(terms.get(1)!.law).toEqual(LAW);
  });
});

/** in (340 K) → feed pipe → mid → radiator → out. `reverse` flips the radiator's from/to. */
function openNetwork(reverse: boolean): Project {
  const pipe: Component = {
    type: "pipe",
    lossModel: "darcy-weisbach",
    geometry: { L: 1, D: 0.02, eps: 0 },
    K: 1,
  };
  const rad: Component = {
    type: "radiator",
    lossModel: "darcy-weisbach",
    geometry: { L: 2, D: 0.012, eps: 0 },
    K: 3,
    radiator: LAW,
  };
  return {
    version: "0.1.0",
    meta: {
      name: "radiator open",
      description: "",
      createdAt: "2026-09-11T00:00:00Z",
      updatedAt: "2026-09-11T00:00:00Z",
    },
    units: {
      system: "SI",
      length: "m",
      pressure: "Pa",
      flow: "m3/s",
      temperature: "K",
      power: "W",
    },
    fluids: { [WATER.id]: WATER },
    analysis: {
      type: "steady",
      flowRegime: "incompressible",
      energy: true,
      gravity: false,
      convergence: {
        massResidual: 1e-10,
        energyResidual: 1e-9,
        maxIter: 80,
        relaxationP: 0.85,
        relaxationQ: 0.7,
      },
    },
    nodes: [
      {
        id: "in",
        kind: "boundary",
        x: 0,
        y: 0,
        z: 0,
        fluid: WATER.id,
        pFixed: P_ATM + 8000,
        tFixed: 340,
      },
      { id: "mid", kind: "junction", x: 1, y: 0, z: 0, fluid: WATER.id },
      { id: "out", kind: "boundary", x: 2, y: 0, z: 0, fluid: WATER.id, pFixed: P_ATM },
    ],
    links: [
      { id: "feed", from: "in", to: "mid", fluid: WATER.id, component: pipe },
      reverse
        ? { id: "rad", from: "out", to: "mid", fluid: WATER.id, component: rad }
        : { id: "rad", from: "mid", to: "out", fluid: WATER.id, component: rad },
    ],
    couplings: [],
  };
}

describe("radiator in an open network", () => {
  for (const reverse of [false, true]) {
    it(`solveSteady matches Radiator.evaluate at the solved ṁ (${reverse ? "reversed" : "forward"} link)`, () => {
      const r = solveSteady(openNetwork(reverse));
      expect(r.status).toBe("converged");
      const L = r.links.rad;
      const C = Math.abs(L.mdot) * WATER.cp;
      const st = Radiator.evaluate(LAW, C, 340);
      expect(st.q).toBeGreaterThan(100);
      expect(L.T_in).toBeCloseTo(340, 9);
      expect(-L.q!).toBeCloseTo(st.q, 6);
      expect(L.T_out).toBeCloseTo(st.T_out, 9);
      expect(r.nodes.out.T).toBeCloseTo(st.T_out, 9);
      expect(r.nodes.out.T).toBeLessThan(340);
      expect(r.nodes.out.T).toBeGreaterThan(LAW.tSink);
    });
  }

  it("rejects the same heat whichever way the link is drawn", () => {
    const fwd = solveSteady(openNetwork(false)).links.rad;
    const rev = solveSteady(openNetwork(true)).links.rad;
    expect(rev.Q).toBeCloseTo(-fwd.Q, 9);
    expect(Math.abs(rev.q! - fwd.q!) / Math.abs(fwd.q!)).toBeLessThan(1e-6);
    expect(rev.T_out).toBeCloseTo(fwd.T_out!, 5);
  });
});
