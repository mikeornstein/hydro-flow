import { hexHeat } from "./thermo";
import { massImbalance } from "./solve";
import type { Project, SolveResult } from "./types";

export interface Check {
  id: string;
  label: string;
  pass: boolean;
  expected: number;
  actual: number;
  tol: number;
  unit: string;
}

export interface VerificationReport {
  pass: boolean;
  checks: Check[];
}

function check(
  id: string,
  label: string,
  actual: number,
  expected: number,
  tol: number,
  unit: string,
  relative = false,
): Check {
  const err = relative
    ? Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-15)
    : Math.abs(actual - expected);
  return {
    id,
    label,
    pass: err <= tol,
    expected,
    actual,
    tol,
    unit,
  };
}

export function verifySolution(project: Project, result: SolveResult): VerificationReport {
  const checks: Check[] = [];

  checks.push(
    check(
      "status",
      "Solver converged",
      result.status === "converged" ? 1 : 0,
      1,
      0,
      "",
    ),
  );

  const imb = massImbalance(project, result);
  const maxImb = Object.values(imb).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  checks.push(check("mass", "Max nodal volume imbalance", maxImb, 0, 1e-9, "m³/s"));

  // Momentum: P_from − P_to should match constitutive Δp
  let maxMom = 0;
  for (const l of project.links) {
    const Pf = result.nodes[l.from].P;
    const Pt = result.nodes[l.to].P;
    const dP = result.links[l.id].dP;
    maxMom = Math.max(maxMom, Math.abs(Pf - Pt - dP));
  }
  checks.push(check("momentum", "Max link momentum residual", maxMom, 0, 0.05, "Pa"));

  if (project.analysis.energy) {
    let qSrc = 0;
    for (const l of project.links) qSrc += l.component.q ?? 0;
    let qHex = 0;
    for (const c of Object.values(result.couplings)) qHex += c.q;
    checks.push(
      check("energy-global", "HEX rejects source heat", qHex, qSrc, 0.002, "", true),
    );

    for (const c of project.couplings) {
      const hx = result.couplings[c.id];
      const hot = result.links[c.hotLinkId];
      const cold = result.links[c.coldLinkId];
      const fH = project.fluids[project.links.find((l) => l.id === c.hotLinkId)!.fluid];
      const fC = project.fluids[project.links.find((l) => l.id === c.coldLinkId)!.fluid];
      const indep = hexHeat({
        UA: c.ua,
        C_hot: Math.abs(hot.mdot) * fH.cp,
        C_cold: Math.abs(cold.mdot) * fC.cp,
        T_hot_in: hx.T_hot_in,
        T_cold_in: hx.T_cold_in,
        arrangement: c.arrangement,
      });
      checks.push(
        check(`hex-q-${c.id}`, `ε-NTU heat ${c.name ?? c.id}`, hx.q, indep.q, 1e-6, "W", true),
      );
      const dT_hot = hx.T_hot_in - hx.T_hot_out;
      const expectedDT = hx.q / (Math.abs(hot.mdot) * fH.cp);
      checks.push(
        check(`hex-dT-${c.id}`, "Hot-stream ΔT from q/(ṁ cp)", dT_hot, expectedDT, 1e-4, "K", true),
      );
    }

    for (const l of project.links) {
      if (!(l.component.q ?? 0)) continue;
      const r = result.links[l.id];
      const f = project.fluids[l.fluid];
      const dT = (r.T_out ?? 0) - (r.T_in ?? 0);
      const expect = (l.component.q ?? 0) / (Math.abs(r.mdot) * f.cp);
      checks.push(
        check(`plate-${l.id}`, `${l.name ?? l.id} coolant ΔT`, dT, expect, 1e-4, "K", true),
      );
    }
  }

  return { pass: checks.every((c) => c.pass), checks };
}
