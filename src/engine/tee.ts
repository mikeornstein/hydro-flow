/**
 * Sharp 90° tee with an equal-area run (F_st = F_c), after Idelchik,
 * Handbook of Hydraulic Resistance, 4th ed. (2007), Chapter 7.
 *
 * Every ζ is a total-pressure loss coefficient on the common-channel velocity,
 * Δp_total = ζ ρ w_c² / 2, with q = Q_s / Q_c and areaRatio = F_s / F_c:
 *   dividing  branch    Diagram 7.18 item 1 (A′ = 1 at 90°, D_s/D_c ≤ 2/3) and item 2 (D_s/D_c = 1)
 *   dividing  straight  Diagram 7.20 No. 1, ζ = τ_st q²
 *   combining branch    Diagram 7.4 with Table 7.1 for A
 *   combining straight  Diagram 7.4, ζ = 1.55 q − q²
 * Valid for turbulent flow in the common channel; ζ may be negative where the
 * handbook says so (energy handed from one stream to the other).
 */

export type TeeMode = "dividing" | "combining";
export type TeeLeg = "branch" | "straight";

type Zeta = (q: number, areaRatio: number) => number;

function dividingBranch(q: number, areaRatio: number): number {
  const wr = q / areaRatio;
  // Diagram 7.18 gives 1.0 on (w_s/w_c)² up to D_s/D_c = 2/3 and 0.3 at
  // D_s/D_c = 1; the handbook is silent between, so interpolate linearly.
  const h = Math.sqrt(areaRatio);
  const k = h <= 2 / 3 ? 1 : h >= 1 ? 0.3 : 1 - 2.1 * (h - 2 / 3);
  return 1 + k * wr * wr;
}

function dividingStraight(q: number, areaRatio: number): number {
  const tau = areaRatio <= 0.4 ? 0.4 : q <= 0.5 ? 2 * (2 * q - 1) : 0.3 * (2 * q - 1);
  return tau * q * q;
}

export function combiningA(q: number, areaRatio: number): number {
  if (areaRatio <= 0.35) return 1;
  return q <= 0.4 ? 0.9 * (1 - q) : 0.55;
}

function combiningBranch(q: number, areaRatio: number): number {
  const wr = q / areaRatio;
  return combiningA(q, areaRatio) * (1 + wr * wr - 2 * (1 - q) ** 2);
}

function combiningStraight(q: number): number {
  return 1.55 * q - q * q;
}

export const ZETA: Record<TeeMode, Record<TeeLeg, Zeta>> = {
  dividing: { branch: dividingBranch, straight: dividingStraight },
  combining: { branch: combiningBranch, straight: combiningStraight },
};

export interface TeeLegState {
  mode: TeeMode;
  leg: TeeLeg;
  /** Common-channel flow magnitude, m³/s. */
  Qc: number;
  /** This leg's flow magnitude, m³/s. */
  Qx: number;
  /** Common-channel flow area, m². */
  Ac: number;
  /** This leg's flow area, m². */
  Ax: number;
  /** Side-branch flow area, m² (selects the handbook row even for the run). */
  As: number;
  rho: number;
}

/**
 * Static pressure drop across the junction in the flow direction:
 * dividing P_c − P_leg, combining P_leg − P_c. Converts the total-pressure
 * coefficient with the leg's own dynamic pressure, so a lossless dividing run
 * recovers ρ(w_c² − w_st²)/2 and a combining run pays it on top of ζ.
 */
export function teeStaticDrop(s: TeeLegState): number {
  if (s.Qc <= 0) return 0;
  const areaRatio = s.As / s.Ac;
  const q = s.leg === "branch" ? Math.min(1, s.Qx / s.Qc) : Math.max(0, 1 - s.Qx / s.Qc);
  const zeta = ZETA[s.mode][s.leg](q, areaRatio);
  const wc = s.Qc / s.Ac;
  const wr = s.Qx / s.Ax / wc;
  const dyn = 0.5 * s.rho * wc * wc;
  return s.mode === "dividing" ? dyn * (zeta - 1 + wr * wr) : dyn * (zeta + 1 - wr * wr);
}

export interface TeeLegFlow {
  /** Signed flow into the junction node, m³/s. */
  into: number;
  /** Flow area, m². */
  area: number;
  role: "branch" | "run";
}

/**
 * Static drop along each leg's own flow direction between the node, which holds
 * the common-channel static pressure, and that leg. The common channel is the
 * run leg carrying the most flow: dividing when it feeds the node, combining
 * when it drains it. The common leg gets zero. A dead-ended run (one run leg,
 * or the far run at rest) makes q = 1, which is the sharp elbow limit. When the
 * side branch itself carries the total flow the handbook has no row, so the
 * junction is lossless.
 */
export function teeLegDrops(legs: TeeLegFlow[], rho: number): number[] {
  const drops = legs.map(() => 0);
  const branch = legs.findIndex((leg) => leg.role === "branch");
  const runs = legs.map((_, i) => i).filter((i) => legs[i].role === "run");
  if (branch < 0 || runs.length === 0) return drops;
  const c = runs.reduce((a, b) => (Math.abs(legs[b].into) > Math.abs(legs[a].into) ? b : a));
  const common = legs[c];
  const Qc = Math.abs(common.into);
  if (Qc === 0) return drops;
  const other = runs.find((i) => i !== c);
  // Both runs flowing the same way means the branch is the common channel.
  if (other !== undefined && legs[other].into * common.into > 1e-6 * Qc * Qc) return drops;
  const mode: TeeMode = common.into > 0 ? "dividing" : "combining";
  legs.forEach((leg, i) => {
    if (i === c) return;
    drops[i] = teeStaticDrop({
      mode,
      leg: leg.role === "branch" ? "branch" : "straight",
      Qc,
      Qx: Math.abs(leg.into),
      Ac: common.area,
      Ax: leg.area,
      As: legs[branch].area,
      rho,
    });
  });
  return drops;
}
