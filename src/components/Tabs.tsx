import { ClipboardList, Layers, Utensils } from "lucide-react";
import type { TabKey } from "../lib/types";

interface Props {
  tab: TabKey;
  onTabChange: (t: TabKey) => void;
}

const TABS: { key: TabKey; label: string; Icon: typeof ClipboardList }[] = [
  { key: "workout", label: "Workout", Icon: ClipboardList },
  { key: "plates", label: "Plates", Icon: Layers },
  { key: "food", label: "Food", Icon: Utensils },
];

export function Tabs({ tab, onTabChange }: Props) {
  return (
    <div className="tabs" role="tablist" aria-label="Sections">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          role="tab"
          aria-selected={tab === key}
          className={tab === key ? "on" : ""}
          onClick={() => onTabChange(key)}
        >
          <Icon aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
