import type { Fluid, LinkDef, NodeDef, Project } from "../types";

/**
 * Cited ISS Active Thermal Control System figures. Operating numbers come
 * from the sources on each field. Pump curves and UA are model sizing so the
 * solve can sit near those anchors; they are not ISS catalog data.
 *
 * Primary: NASA ATCS overview
 * https://www.nasa.gov/wp-content/uploads/2021/02/473486main_iss_atcs_overview.pdf
 * Also NASA/TM—2007–214964 Table 1; NTRS 20150004079 (alternate pressure/T).
 * Fluids: NIST WebBook at the cited T and p.
 */
export class IssAtcsFigures {
  /** avoirdupois pound, kg. */
  static readonly LB = 0.45359237;
  /** International psi, Pa. */
  static readonly PSI = 6894.757293168;

  /** EATCS nameplate, W per ammonia loop. NASA ATCS overview. */
  static readonly EATCS_LOOP_W = 35_000;
  static readonly EATCS_LOOPS = 2;

  /** Early External ATCS capability, W. NASA ATCS overview. Separate from EATCS. */
  static readonly EEATCS_W = 14_000;
  /** Photovoltaic radiator capability each, W. NASA ATCS overview. Not this schematic. */
  static readonly PVR_W = 14_000;

  /** Lab Low Temperature Loop supply, K (40 °F). NASA ATCS overview. Band 3.3–5.5 °C in TM-2007 Table 1. */
  static readonly LTL_SUPPLY_K = 273.15 + 4;
  static readonly LTL_BAND_C: readonly [number, number] = [3.3, 5.5];
  /** Lab inventory, L. NASA ATCS overview. */
  static readonly LTL_INVENTORY_L = 63;

  /** Lab Moderate Temperature Loop supply, K (63 °F). NASA ATCS overview. Band 16.1–18.3 °C in TM-2007 Table 1. */
  static readonly MTL_SUPPLY_K = 273.15 + 17;
  static readonly MTL_BAND_C: readonly [number, number] = [16.1, 18.3];
  static readonly MTL_INVENTORY_L = 200;

  /** EATCS ammonia supply, K (37 °F). NASA ATCS overview. */
  static readonly NH3_SUPPLY_K = 273.15 + 2.8;
  /** Loop A nominal, lb/h. NASA ATCS overview. */
  static readonly LOOP_A_LB_H = 8200;
  /** Loop B nominal, lb/h. NASA ATCS overview. */
  static readonly LOOP_B_LB_H = 8900;
  /** Pump-inlet pressure, psia. NASA ATCS overview. */
  static readonly PUMP_INLET_PSIA = 300;
  /** Radiator outlet goal, K (−40 °F). NASA ATCS overview TRRJ/RGAC. Used as radiator tSink. */
  static readonly RAD_OUTLET_GOAL_K = (5 / 9) * ( -40 - 32) + 273.15;

  /**
   * Alternate published nominal, not used as the model BC.
   * NTRS 20150004079 (Bruckner / Manco): 2.62 MPa, 275 K (380 psia, 36 °F).
   */
  static readonly ALT_P_PA = 2.62e6;
  static readonly ALT_T_K = 275;
  static readonly ALT_PSIA = 380;

  /** IATCS Simulator heat-load capability, W. NASA/TM—2007–214964 Table 1. Ground facility only. */
  static readonly SIMULATOR_W = 28_700;
  /** IATCS normal operating pressure band, psia. TM-2007 Table 1. */
  static readonly IATCS_P_PSIA: readonly [number, number] = [50, 90];
  /** Point inside that band, used for water tank pFixed and the NIST water query. */
  static readonly IATCS_P_PSIA_MODEL = 65;

  static lbHToKgS(lbH: number): number {
    return (lbH * IssAtcsFigures.LB) / 3600;
  }

  static loopAKgS(): number {
    return IssAtcsFigures.lbHToKgS(IssAtcsFigures.LOOP_A_LB_H);
  }

  static loopBKgS(): number {
    return IssAtcsFigures.lbHToKgS(IssAtcsFigures.LOOP_B_LB_H);
  }

  static pumpInletPa(): number {
    return IssAtcsFigures.PUMP_INLET_PSIA * IssAtcsFigures.PSI;
  }

  static iatcsTankPa(): number {
    return IssAtcsFigures.IATCS_P_PSIA_MODEL * IssAtcsFigures.PSI;
  }

  static kgSToLbH(mdot: number): number {
    return (mdot * 3600) / IssAtcsFigures.LB;
  }
}

/** NIST WebBook, liquid, 277.15 K, 0.448 MPa (65 psia, TM-2007 band). */
export const IATCS_LT: Fluid = {
  id: "iatcs-lt",
  name: "IATCS low-temperature water (4 °C)",
  phase: "liquid",
  rho: 1000.1,
  mu: 1.5667e-3,
  cp: 4206,
  k: 0.56571,
  beta: 1e-6,
  Tref: IssAtcsFigures.LTL_SUPPLY_K,
};

/** NIST WebBook, liquid, 290.15 K, 0.448 MPa. */
export const IATCS_MT: Fluid = {
  id: "iatcs-mt",
  name: "IATCS moderate-temperature water (17 °C)",
  phase: "liquid",
  rho: 998.94,
  mu: 1.0797e-3,
  cp: 4185.3,
  k: 0.59279,
  beta: 1.7e-4,
  Tref: IssAtcsFigures.MTL_SUPPLY_K,
};

/** NIST WebBook, liquid ammonia, 275.95 K, 2.068 MPa (300 psia). */
export const EATCS_NH3: Fluid = {
  id: "eatcs-nh3",
  name: "EATCS anhydrous ammonia (2.8 °C, 300 psia)",
  phase: "liquid",
  rho: 635.97,
  mu: 1.6134e-4,
  cp: 4612.6,
  k: 0.52005,
  beta: 2.2e-3,
  Tref: IssAtcsFigures.NH3_SUPPLY_K,
};

const COPPER = 1.5e-6;
const PX = 80;

export class IssAtcs {
  static readonly FILE = "iss-atcs.hydroflow.json";
  static readonly ID = "iss-atcs";

  static readonly PACK = {
    nChannels: 3,
    headerD: 0.028,
    branchD: 0.012,
    branchL: 0.4,
    pitch: 0.08,
    eps: COPPER,
    tees: false,
  } as const;

  /** Model sizing: IFHX UA, W/K. Not a published ISS number. */
  static readonly IFHX_UA_LTL = 20_000;
  static readonly IFHX_UA_MTL = 2_300;
  /** Model sizing: radiator wing UA, W/K. tSink is the published −40 °F goal. */
  static readonly RAD_UA = 760;

  static loopAVolM3s(): number {
    return IssAtcsFigures.loopAKgS() / EATCS_NH3.rho;
  }

  static loopBVolM3s(): number {
    return IssAtcsFigures.loopBKgS() / EATCS_NH3.rho;
  }

  /** Quadratic pump H = H0 + c2 Q² so H(Qop)=Hop and free delivery is 1.08 Qop. */
  static pumpCoeffs(Qop: number, Hop: number): number[] {
    const Qfree = Qop * 1.08;
    const H0 = Hop / (1 - (Qop / Qfree) ** 2);
    return [H0, 0, -H0 / (Qfree * Qfree)];
  }

  static project(): Project {
    const F = IssAtcsFigures;
    const lt = IATCS_LT.id;
    const mt = IATCS_MT.id;
    const nh = EATCS_NH3.id;
    const qa = IssAtcs.loopAVolM3s();
    const qb = IssAtcs.loopBVolM3s();
    const qw = 0.0012;
    const nh3Pump = IssAtcs.pumpCoeffs(qa, 12);
    const nh3PumpB = IssAtcs.pumpCoeffs(qb, 12);
    const wPump = IssAtcs.pumpCoeffs(qw, 10);

    const node = (
      id: string,
      name: string,
      x: number,
      y: number,
      fluid: string,
      extra: Partial<NodeDef> = {},
    ): NodeDef => {
      const kind = extra.kind ?? (extra.pFixed !== undefined ? "tank" : "junction");
      const n: NodeDef = { id, name, x, y, z: 0, fluid, kind };
      if (extra.pFixed !== undefined) n.pFixed = extra.pFixed;
      if (extra.tFixed !== undefined) n.tFixed = extra.tFixed;
      return n;
    };

    const dw = (
      id: string,
      name: string,
      from: string,
      to: string,
      fluid: string,
      component: LinkDef["component"],
    ): LinkDef => ({ id, name, from, to, fluid, component });

    return {
      version: "0.1.0",
      meta: {
        name: "ISS Active Thermal Control System",
        description:
          "United States Orbital Segment class schematic: Lab Low and Moderate Temperature water loops, two External Active Thermal Control System ammonia loops, interface heat exchangers, and pumped radiator wings. Russian modules out of scope. 70 kW is the External Active Thermal Control System nameplate (35 kW × 2). The 28.7 kW figure is the Marshall Internal Active Thermal Control System Simulator, not on-orbit nameplate.",
        createdAt: "2026-09-12T00:00:00Z",
        updatedAt: "2026-09-12T00:00:00Z",
      },
      units: {
        system: "SI",
        length: "m",
        pressure: "kPa",
        flow: "L/min",
        temperature: "C",
        power: "kW",
      },
      fluids: {
        [IATCS_LT.id]: IATCS_LT,
        [IATCS_MT.id]: IATCS_MT,
        [EATCS_NH3.id]: EATCS_NH3,
      },
      analysis: {
        type: "steady",
        flowRegime: "incompressible",
        energy: true,
        gravity: false,
        convergence: {
          massResidual: 1e-10,
          energyResidual: 1e-8,
          maxIter: 200,
          relaxationP: 0.8,
          relaxationQ: 0.7,
        },
      },
      nodes: [
        node("lt-tank", "Lab Low Temperature accumulator (~63 L, ~4 °C)", 0, PX, lt, {
          pFixed: F.iatcsTankPa(),
        }),
        node("lt-supply", "Low Temperature supply header", PX * 2, PX, lt),
        node("lt-return", "Low Temperature return header", PX * 5, PX, lt),
        node("lt-ifhx-in", "Low Temperature interface heat exchanger water inlet", PX * 6, PX, lt),
        node("mt-tank", "Lab Moderate Temperature accumulator (~200 L, ~17 °C)", 0, PX * 4, mt, {
          pFixed: F.iatcsTankPa(),
        }),
        node("mt-supply", "Moderate Temperature supply header", PX * 2, PX * 4, mt),
        node("mt-return", "Moderate Temperature return header", PX * 5, PX * 4, mt),
        node("mt-ifhx-in", "Moderate Temperature interface heat exchanger water inlet", PX * 6, PX * 4, mt),
        node("a-tank", "Loop A pump module inlet (300 psia published)", 0, PX * 2, nh, {
          pFixed: F.pumpInletPa(),
        }),
        node("a-ifhx-in", "Loop A interface heat exchanger ammonia inlet", PX * 3, PX * 2, nh),
        node("a-rad-in", "Loop A radiator wing inlet", PX * 6, PX * 2, nh),
        node("b-tank", "Loop B pump module inlet (300 psia published)", 0, PX * 5, nh, {
          pFixed: F.pumpInletPa(),
        }),
        node("b-ifhx-in", "Loop B interface heat exchanger ammonia inlet", PX * 3, PX * 5, nh),
        node("b-rad-in", "Loop B radiator wing inlet", PX * 6, PX * 5, nh),
      ],
      links: [
        dw("lt-pump", "Low Temperature water pump", "lt-tank", "lt-supply", lt, {
          type: "pump",
          lossModel: "darcy-weisbach",
          geometry: { L: 0, D: 0.04, eps: COPPER },
          K: 1.2,
          pump: { coeffs: wPump, hMin: 0 },
        }),
        dw("lt-load", "Low Temperature lab and module loads (35 kW EATCS nameplate)", "lt-return", "lt-ifhx-in", lt, {
          type: "cold-plate",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.4, D: 0.02, eps: COPPER },
          K: 4,
          q: F.EATCS_LOOP_W,
          rTh: 0.0002,
        }),
        dw(
          "lt-ifhx",
          "Interface heat exchanger (water to ammonia), Low Temperature water stream",
          "lt-ifhx-in",
          "lt-tank",
          lt,
          {
            type: "hex-stream",
            lossModel: "darcy-weisbach",
            geometry: { L: 1.0, D: 0.02, eps: COPPER },
            K: 6,
          },
        ),
        dw("mt-pump", "Moderate Temperature water pump", "mt-tank", "mt-supply", mt, {
          type: "pump",
          lossModel: "darcy-weisbach",
          geometry: { L: 0, D: 0.04, eps: COPPER },
          K: 1.2,
          pump: { coeffs: wPump, hMin: 0 },
        }),
        dw("mt-load", "Moderate Temperature lab and module loads (35 kW EATCS nameplate)", "mt-return", "mt-ifhx-in", mt, {
          type: "cold-plate",
          lossModel: "darcy-weisbach",
          geometry: { L: 0.4, D: 0.02, eps: COPPER },
          K: 4,
          q: F.EATCS_LOOP_W,
          rTh: 0.0002,
        }),
        dw(
          "mt-ifhx",
          "Interface heat exchanger (water to ammonia), Moderate Temperature water stream",
          "mt-ifhx-in",
          "mt-tank",
          mt,
          {
            type: "hex-stream",
            lossModel: "darcy-weisbach",
            geometry: { L: 1.0, D: 0.02, eps: COPPER },
            K: 6,
          },
        ),
        dw("a-pump", "Loop A pump module (nominal 8200 lb/h)", "a-tank", "a-ifhx-in", nh, {
          type: "pump",
          lossModel: "darcy-weisbach",
          geometry: { L: 0, D: 0.05, eps: COPPER },
          K: 1.2,
          pump: { coeffs: nh3Pump, hMin: 0 },
        }),
        dw(
          "a-ifhx",
          "Interface heat exchanger (water to ammonia), Loop A ammonia stream",
          "a-ifhx-in",
          "a-rad-in",
          nh,
          {
            type: "hex-stream",
            lossModel: "darcy-weisbach",
            geometry: { L: 1.2, D: 0.03, eps: COPPER },
            K: 6,
          },
        ),
        dw("a-rad", "Loop A heat-rejection radiator wing (three parallel panels)", "a-rad-in", "a-tank", nh, {
          type: "radiator",
          lossModel: "darcy-weisbach",
          geometry: { L: 8, D: 0.02, A: 0.002, eps: COPPER },
          K: 8,
          parallelCount: 3,
          radiator: { ua: IssAtcs.RAD_UA, tSink: F.RAD_OUTLET_GOAL_K },
        }),
        dw("b-pump", "Loop B pump module (nominal 8900 lb/h)", "b-tank", "b-ifhx-in", nh, {
          type: "pump",
          lossModel: "darcy-weisbach",
          geometry: { L: 0, D: 0.05, eps: COPPER },
          K: 1.2,
          pump: { coeffs: nh3PumpB, hMin: 0 },
        }),
        dw(
          "b-ifhx",
          "Interface heat exchanger (water to ammonia), Loop B ammonia stream",
          "b-ifhx-in",
          "b-rad-in",
          nh,
          {
            type: "hex-stream",
            lossModel: "darcy-weisbach",
            geometry: { L: 1.2, D: 0.03, eps: COPPER },
            K: 6,
          },
        ),
        dw("b-rad", "Loop B heat-rejection radiator wing (three parallel panels)", "b-rad-in", "b-tank", nh, {
          type: "radiator",
          lossModel: "darcy-weisbach",
          geometry: { L: 8, D: 0.02, A: 0.002, eps: COPPER },
          K: 8,
          parallelCount: 3,
          radiator: { ua: IssAtcs.RAD_UA, tSink: F.RAD_OUTLET_GOAL_K },
        }),
      ],
      couplings: [
        {
          id: "ifhx-lt",
          name: "Lab Low Temperature interface heat exchanger (water to ammonia)",
          type: "hex",
          hotLinkId: "lt-ifhx",
          coldLinkId: "a-ifhx",
          ua: IssAtcs.IFHX_UA_LTL,
          arrangement: "counterflow",
        },
        {
          id: "ifhx-mt",
          name: "Lab Moderate Temperature interface heat exchanger (water to ammonia)",
          type: "hex",
          hotLinkId: "mt-ifhx",
          coldLinkId: "b-ifhx",
          ua: IssAtcs.IFHX_UA_MTL,
          arrangement: "counterflow",
        },
      ],
      modules: [
        {
          id: "cold-plate-pack",
          name: "Cold-plate channel pack",
          kind: "u-manifold-pack",
          params: { ...IssAtcs.PACK },
        },
      ],
      instances: [
        {
          id: "lt-packs",
          name: "Low Temperature cold-plate pack",
          module: "cold-plate-pack",
          count: 2,
          ports: { inlet: "lt-supply", outlet: "lt-return" },
          x: PX * 3.5,
          y: 0,
          fluid: lt,
        },
        {
          id: "mt-packs",
          name: "Moderate Temperature cold-plate pack",
          module: "cold-plate-pack",
          count: 2,
          ports: { inlet: "mt-supply", outlet: "mt-return" },
          x: PX * 3.5,
          y: PX * 3.5,
          fluid: mt,
        },
      ],
    };
  }
}
