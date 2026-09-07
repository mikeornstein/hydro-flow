import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MF04_LOADS_W,
  MF04_UNBALANCED_T_C,
  mf04MicrochannelOrifice,
} from "../src/engine/examples/mf04Microchannel";
import { solveSteady } from "../src/engine/solve";

const OUT = "tests/fixtures/paper/out";

describe("MF04 microchannel orifice + energy", () => {
  it("unbalanced bases order with load; orifices pull flow to high-load branch", () => {
    mkdirSync(OUT, { recursive: true });
    const rows = [
      "mode\tsink\tload_W\tQ_m3s\tT_surface_C\tpaper_unbal_T_C",
    ];

    const unb = solveSteady(mf04MicrochannelOrifice("unbalanced"));
    const bal = solveSteady(mf04MicrochannelOrifice("orifice-balanced"));
    expect(unb.status).toBe("converged");
    expect(bal.status).toBe("converged");

    const tUnb: number[] = [];
    const qUnb: number[] = [];
    const tBal: number[] = [];
    const qBal: number[] = [];
    for (let i = 0; i < 3; i++) {
      const id = `hs-${i + 1}`;
      tUnb.push(unb.links[id].T_surface! - 273.15);
      qUnb.push(unb.links[id].Q);
      tBal.push(bal.links[id].T_surface! - 273.15);
      qBal.push(bal.links[id].Q);
      rows.push(
        `unbalanced\t${i + 1}\t${MF04_LOADS_W[i]}\t${qUnb[i]}\t${tUnb[i].toFixed(2)}\t${MF04_UNBALANCED_T_C[i]}`,
      );
      rows.push(
        `orifice-balanced\t${i + 1}\t${MF04_LOADS_W[i]}\t${qBal[i]}\t${tBal[i].toFixed(2)}\t`,
      );
    }
    writeFileSync(`${OUT}/mf04-orifice-energy.tsv`, rows.join("\n") + "\n");

    expect(tUnb[2]).toBeGreaterThan(tUnb[1]);
    expect(tUnb[1]).toBeGreaterThan(tUnb[0]);
    expect(qBal[2]).toBeGreaterThan(qBal[0]);
    expect(Math.max(...tBal)).toBeLessThan(Math.max(...tUnb));

    // Absolute base-T match needs published manifold Q; document gap in fixture.
    writeFileSync(
      "tests/fixtures/paper/mf04-blocker.json",
      JSON.stringify(
        {
          paper: "MF04",
          status: "partial",
          have: [
            "fRe 57/62 (aspect 1/2)",
            "loads 70/120/200 W",
            "unbalanced bases 33.1/42.3/49.8 C",
            "engine energy path with rTh/q",
            "orifice rebalance direction",
          ],
          missing: [
            "system FNM channel count / header lengths",
            "Nu values for system energy (text cut off; CFD part cites aspect Nu)",
            "inlet coolant T for the three-sink FNM",
            "balanced orifice openings / resulting Q table",
          ],
          note: "rTh pinned from published unbalanced bases under equal-share assumption; not a claim of full geometric reconstruction.",
        },
        null,
        2,
      ) + "\n",
    );
  });
});
