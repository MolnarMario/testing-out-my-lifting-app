import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import type { Unit } from "../lib/types";
import { MaxesModal } from "./MaxesModal";

interface Props {
  unit: Unit;
  onUnitChange: (u: Unit) => void;
}

export function TopBar({ unit, onUnitChange }: Props) {
  const [maxesOpen, setMaxesOpen] = useState(false);

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M4 12h2M18 12h2M8 12h8M6 8v8M18 8v8" />
          </svg>
        </div>
        <div>
          <div className="brand-name">
            IRON<b>LOG</b>
          </div>
          <div className="brand-sub">Powerlifting Tracker</div>
        </div>
      </div>

      <button className="maxes-btn" onClick={() => setMaxesOpen(true)}>
        <ArrowLeftRight />
        1RM
      </button>

      <div className="unit-toggle">
        <button className={unit === "kg" ? "on" : ""} onClick={() => onUnitChange("kg")}>
          kg
        </button>
        <button className={unit === "lb" ? "on" : ""} onClick={() => onUnitChange("lb")}>
          lb
        </button>
      </div>

      {maxesOpen && <MaxesModal unit={unit} onClose={() => setMaxesOpen(false)} />}
    </div>
  );
}
