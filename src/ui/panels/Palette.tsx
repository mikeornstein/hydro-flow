import type { EquipmentKind } from "../../diagram/types";
import { useStore } from "../store";

const ITEMS: { kind: EquipmentKind; label: string; domain: string }[] = [
  { kind: "tank", label: "Tank", domain: "liquid" },
  { kind: "pump", label: "Pump", domain: "liquid" },
  { kind: "valve", label: "Valve", domain: "liquid" },
  { kind: "filter", label: "Filter", domain: "liquid" },
  { kind: "orifice", label: "Orifice", domain: "liquid" },
  { kind: "junction", label: "Junction", domain: "liquid" },
  { kind: "coldPlate", label: "Cold plate", domain: "heat" },
  { kind: "heatExchanger", label: "Air–liquid HEX", domain: "heat" },
  { kind: "fan", label: "Fan", domain: "air" },
  { kind: "boundary", label: "Boundary", domain: "air" },
];

export interface PaletteProps {
  /** Runs after the existing pending-kind store action. */
  onChoose?(): void;
}

export function Palette({ onChoose }: PaletteProps) {
  const pending = useStore((s) => s.pendingKind);
  const setPending = useStore((s) => s.setPendingKind);
  return (
    <aside className="palette">
      <div className="panel-kicker">Library</div>
      <p className="palette-help">Click a part, then click the canvas to place it. Drag ports to pipe them.</p>
      <ul>
        {ITEMS.map((it) => (
          <li key={it.kind}>
            <button
              type="button"
              className={`palette-item domain-${it.domain} ${pending === it.kind ? "is-active" : ""}`}
              onClick={() => {
                setPending(pending === it.kind ? null : it.kind);
                onChoose?.();
              }}
            >
              <span className="swatch" />
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
