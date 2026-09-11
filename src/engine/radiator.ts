import { epsilonNtu } from "./thermo";
import type { LinkDef, Project, RadiatorLaw } from "./types";

export interface RadiatorConductance {
  /** |ṁ| cp, W/K. */
  C: number;
  ntu: number;
  effectiveness: number;
  /** Linearized conductance U = ε C, W/K. Multiplies (T_in − tSink). 0 when C = 0. */
  U: number;
}

/** One radiator link at the solved flow, ready for energy assembly. */
export interface RadiatorTerm extends RadiatorConductance {
  law: RadiatorLaw;
}

/** Post-solve evaluation at a known inlet temperature. */
export interface RadiatorState extends RadiatorConductance {
  /** Heat leaving the fluid, W. Positive when T_in > tSink. */
  q: number;
  T_in: number;
  /** (1 − ε) T_in + ε tSink. */
  T_out: number;
  tSink: number;
}

export class Radiator {
  /**
   * The radiator law carried by a link, or null. Enforces the biconditional
   * `type === "radiator"` iff `component.radiator`, and rejects a prescribed
   * `q` beside the law, since a radiator's heat is solved rather than given.
   */
  static lawOf(link: LinkDef): RadiatorLaw | null {
    const c = link.component;
    const law = c.radiator;
    if (c.type === "radiator" && !law) {
      throw new Error(`Link ${link.id}: type radiator needs component.radiator`);
    }
    if (law && c.type !== "radiator") {
      throw new Error(`Link ${link.id}: component.radiator needs type radiator`);
    }
    if (!law) return null;
    if (!(Number.isFinite(law.ua) && law.ua > 0)) {
      throw new Error(`Link ${link.id}: radiator ua must be > 0, got ${law.ua}`);
    }
    if (!(Number.isFinite(law.tSink) && law.tSink > 0)) {
      throw new Error(`Link ${link.id}: radiator tSink must be > 0 K, got ${law.tSink}`);
    }
    if (c.q !== undefined) {
      throw new Error(`Link ${link.id}: a radiator has no prescribed q`);
    }
    return law;
  }

  /**
   * U = ε C from the ε-NTU primitive in its Cr = 0 limit. Counterflow is
   * pinned because it evaluates to exactly 1 − exp(−NTU) there, while the
   * crossflow-unmixed closure underflows to ε = 0.
   */
  static conductance(law: RadiatorLaw, C: number): RadiatorConductance {
    const e = epsilonNtu({
      UA: law.ua,
      C_hot: C,
      C_cold: Number.POSITIVE_INFINITY,
      arrangement: "counterflow",
    });
    return { C, ntu: e.ntu, effectiveness: e.effectiveness, U: e.effectiveness * C };
  }

  static evaluate(law: RadiatorLaw, C: number, T_in: number): RadiatorState {
    const k = Radiator.conductance(law, C);
    const q = k.U * (T_in - law.tSink);
    return {
      ...k,
      q,
      T_in,
      T_out: C > 1e-15 ? T_in - q / C : T_in,
      tSink: law.tSink,
    };
  }

  /** Every radiator link keyed by its index in `project.links`, at the solved flows. */
  static index(
    project: Pick<Project, "links" | "couplings" | "fluids">,
    Q: number[],
  ): Map<number, RadiatorTerm> {
    const hexLinks = new Set(project.couplings.flatMap((c) => [c.hotLinkId, c.coldLinkId]));
    const out = new Map<number, RadiatorTerm>();
    project.links.forEach((link, k) => {
      const law = Radiator.lawOf(link);
      if (!law) return;
      if (hexLinks.has(link.id)) {
        throw new Error(`Link ${link.id}: radiator law on a HEX stream`);
      }
      const f = project.fluids[link.fluid];
      if (!f) throw new Error(`Missing fluid ${link.fluid}`);
      const C = f.rho * Math.abs(Q[k]) * f.cp;
      out.set(k, { law, ...Radiator.conductance(law, C) });
    });
    return out;
  }
}
