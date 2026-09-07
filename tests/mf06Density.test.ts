import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MF06_DENSITY_RATIO_5000FT,
  MF06_R_IMP,
  MF06_TABLE4_MF,
  mf06AltitudeDensity,
  mf06RQuadSi,
} from "../src/engine/examples/mf06AltitudeDensity";
import { solveSteady } from "../src/engine/solve";
import table4 from "./fixtures/paper/mf06-table4.json";

const OUT = "tests/fixtures/paper/out";
const CFM = 2118.8799727597;

describe("MF06 altitude density + published section R", () => {
  it("records Table 4 historical anchors", () => {
    expect(table4.sections.cpu_power.MacroFlow).toBe(398);
    expect(table4.sections.cpu_power.Exp).toBe(398);
    expect(table4.sections.cpu_power.Ellison_vs_Exp_pct).toBeCloseTo(17.8, 1);
    expect(table4.altitude_ft).toBe(5000);
    expect(MF06_R_IMP.cpuPower).toBeCloseTo(1.31e-6, 12);
    expect(MF06_R_IMP.pciMemory).toBeCloseTo(6.67e-6, 12);
    expect(mf06RQuadSi(MF06_R_IMP.cpuPower)).toBeGreaterThan(0);
  });

  it("sea-level operating point lands on MacroFlow Table 4 within 2%", () => {
    mkdirSync(OUT, { recursive: true });
    const sl = solveSteady(mf06AltitudeDensity(0));
    expect(sl.status).toBe("converged");
    const cpu = sl.links["cpu-power"].Q * CFM;
    const pci = sl.links["pci-memory"].Q * CFM;
    expect(Math.abs(cpu - MF06_TABLE4_MF.cpuPower_CFM) / MF06_TABLE4_MF.cpuPower_CFM).toBeLessThan(
      0.02,
    );
    expect(
      Math.abs(pci - MF06_TABLE4_MF.pciMemory_CFM) / MF06_TABLE4_MF.pciMemory_CFM,
    ).toBeLessThan(0.02);
  });

  it("lower density raises volumetric CFM for the same Pa fan curve", () => {
    mkdirSync(OUT, { recursive: true });
    const sl = solveSteady(mf06AltitudeDensity(0));
    const hi = solveSteady(mf06AltitudeDensity(5000));
    expect(sl.status).toBe("converged");
    expect(hi.status).toBe("converged");
    const rows = [
      "altitude_ft\tdensity_ratio\tcpu_CFM\tpci_CFM\ttotal_CFM\tpaper_MF_cpu\tpaper_MF_pci",
    ];
    const pack = (alt: number, ratio: number, r: typeof sl) => {
      const cpu = r.links["cpu-power"].Q * CFM;
      const pci = r.links["pci-memory"].Q * CFM;
      rows.push(
        `${alt}\t${ratio.toFixed(3)}\t${cpu.toFixed(1)}\t${pci.toFixed(1)}\t${(cpu + pci).toFixed(1)}\t${MF06_TABLE4_MF.cpuPower_CFM}\t${MF06_TABLE4_MF.pciMemory_CFM}`,
      );
      return { cpu, pci, total: cpu + pci };
    };
    const a = pack(0, 1, sl);
    const b = pack(5000, MF06_DENSITY_RATIO_5000FT, hi);
    writeFileSync(`${OUT}/mf06-density-comparison.tsv`, rows.join("\n") + "\n");
    expect(b.total).toBeGreaterThan(a.total);
    expect(b.total / a.total).toBeGreaterThan(1.02);
  });
});
