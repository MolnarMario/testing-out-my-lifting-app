import { Utensils } from "lucide-react";
import type { Unit } from "../../lib/types";

interface Props {
  unit: Unit;
}

export function FoodTab({ unit }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <Utensils aria-hidden="true" />
          Food
        </div>
        <span className="card-note">Not rebuilt yet</span>
      </div>

      <div className="empty">
        <Utensils aria-hidden="true" />
        <div className="t">Coming back soon</div>
        <div className="d">
          The macro journal — bodyweight in {unit}, calories and macros — is still on the rewrite
          list. The original is preserved in <code>legacy/index.html</code>.
        </div>
      </div>
    </div>
  );
}
