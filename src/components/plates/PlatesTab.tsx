import { Layers } from "lucide-react";
import type { Unit } from "../../lib/types";

interface Props {
  unit: Unit;
}

export function PlatesTab({ unit }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <Layers aria-hidden="true" />
          Plate Loader
        </div>
        <span className="card-note">Not rebuilt yet</span>
      </div>

      <div className="empty">
        <Layers aria-hidden="true" />
        <div className="t">Coming back soon</div>
        <div className="d">
          The barbell loading calculator ({unit}) is still on the rewrite list. The original is
          preserved in <code>legacy/index.html</code>.
        </div>
      </div>
    </div>
  );
}
