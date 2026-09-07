import { compileDiagram } from "../../diagram/compile";
import type { Project } from "../types";
import { dlcPumpedCoolingDiagram } from "./dlcPumpedCooling";
import { mf01MultiplicityChassis } from "./mf01Multiplicity";
import { mf03ColdPlateHeader } from "./mf03ColdPlateHeader";
import { mf03OrificeBalance } from "./mf03OrificeBalance";
import { mf04MicrochannelOrifice } from "./mf04Microchannel";
import { mf06AltitudeDensity } from "./mf06AltitudeDensity";
import { mf08BypassBalance, mf08ServerFan } from "./mf08BypassBalance";
import { mf09HeatSinkBypass } from "./mf09HeatSinkBypass";
import { mf11ExpandedBlock, mf11LcmAtPublishedPoint } from "./mf11Composite";
import { mf13CardCabinet } from "./mf13CardCabinet";
import { mf14Enclosure } from "./mf14Enclosure";

export interface ProjectExampleSource {
  /** Basename under examples/. */
  file: string;
  build: () => Project;
}

export const PROJECT_EXAMPLE_SOURCES: readonly ProjectExampleSource[] = [
  {
    file: "mf03-orifice-balance-tuned.hydroflow.json",
    build: () => mf03OrificeBalance("tuned"),
  },
  {
    file: "mf03-orifice-balance-energy-tuned.hydroflow.json",
    build: () => mf03OrificeBalance("tuned", { energy: true }),
  },
  {
    file: "mf04-orifice-balanced.hydroflow.json",
    build: () => mf04MicrochannelOrifice("orifice-balanced"),
  },
  {
    file: "mf11-lcm-table1.hydroflow.json",
    build: () => mf11LcmAtPublishedPoint(),
  },
  {
    file: "mf11-composite-expanded.hydroflow.json",
    build: () => mf11ExpandedBlock(),
  },
  {
    file: "mf01-multiplicity-chassis.hydroflow.json",
    build: () => mf01MultiplicityChassis(),
  },
  {
    file: "mf06-altitude-sea-level.hydroflow.json",
    build: () => mf06AltitudeDensity(0),
  },
  {
    file: "mf06-altitude-5000ft.hydroflow.json",
    build: () => mf06AltitudeDensity(5000),
  },
  {
    file: "mf08-bypass-balance.hydroflow.json",
    build: () => mf08BypassBalance(0.36),
  },
  {
    file: "mf08-server-fan-caseB.hydroflow.json",
    build: () => mf08ServerFan("B"),
  },
  {
    file: "mf09-heat-sink-bypass.hydroflow.json",
    build: () => mf09HeatSinkBypass(0.2),
  },
  {
    file: "mf14-enclosure.hydroflow.json",
    build: () => mf14Enclosure(),
  },
  {
    file: "mf03-cold-plate-header-7_16.hydroflow.json",
    build: () => mf03ColdPlateHeader("7/16", { tees: false, correlation: "idelchik" }),
  },
  {
    file: "mf03-cold-plate-header-7_16-tees.hydroflow.json",
    build: () => mf03ColdPlateHeader("7/16", { tees: true, correlation: "idelchik" }),
  },
  {
    file: "mf03-cold-plate-header-7_16-gardel.hydroflow.json",
    build: () => mf03ColdPlateHeader("7/16", { tees: true, correlation: "gardel" }),
  },
  {
    file: "mf03-cold-plate-header-7_8.hydroflow.json",
    build: () => mf03ColdPlateHeader("7/8", { tees: false, correlation: "idelchik" }),
  },
  {
    file: "mf03-cold-plate-header-7_8-tees.hydroflow.json",
    build: () => mf03ColdPlateHeader("7/8", { tees: true, correlation: "idelchik" }),
  },
  {
    file: "mf03-cold-plate-header-7_8-gardel.hydroflow.json",
    build: () => mf03ColdPlateHeader("7/8", { tees: true, correlation: "gardel" }),
  },
  {
    file: "mf13-card-cabinet-designI-friction.hydroflow.json",
    build: () => mf13CardCabinet({ design: "I", tees: false }),
  },
  {
    file: "mf13-card-cabinet-designI-tees.hydroflow.json",
    build: () => mf13CardCabinet({ design: "I", tees: true, correlation: "idelchik" }),
  },
  {
    file: "mf13-card-cabinet-designI-gardel.hydroflow.json",
    build: () => mf13CardCabinet({ design: "I", tees: true, correlation: "gardel" }),
  },
  {
    file: "mf13-card-cabinet-designII-tees.hydroflow.json",
    build: () => mf13CardCabinet({ design: "II", tees: true, correlation: "idelchik" }),
  },
  {
    file: "mf13-card-cabinet-designII-gardel.hydroflow.json",
    build: () => mf13CardCabinet({ design: "II", tees: true, correlation: "gardel" }),
  },
  {
    file: "dlc-pumped-cooling.hydroflow.json",
    build: () =>
      compileDiagram(dlcPumpedCoolingDiagram(), { createdAt: "2026-09-07T00:00:00Z" }),
  },
];
