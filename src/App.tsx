import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { TopBar } from "./components/TopBar";
import { Tabs } from "./components/Tabs";
import { WorkoutTab } from "./components/workout/WorkoutTab";
import { PlatesTab } from "./components/plates/PlatesTab";
import type { PlatePreset } from "./components/plates/PlatesTab";
import { FoodTab } from "./components/food/FoodTab";
import { useUnit } from "./hooks/useUnit";
import { usePersistenceBroken } from "./hooks/useLocalStorage";
import type { TabKey } from "./lib/types";

export default function App() {
  const [tab, setTab] = useState<TabKey>("workout");
  const [unit, setUnit] = useUnit();
  const persistenceBroken = usePersistenceBroken();
  const [platePreset, setPlatePreset] = useState<PlatePreset | null>(null);

  /** Sends a logged set's weight (in display units) to the plate loader. */
  function loadOnBar(weight: number) {
    setPlatePreset((prev) => ({ value: weight, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab("plates");
  }

  return (
    <div className="wrap">
      <TopBar unit={unit} onUnitChange={setUnit} />

      {persistenceBroken && (
        <div className="warn-banner" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>
            This browser is not saving your data — private mode or full storage. Anything you log
            now will be lost when you close the tab.
          </span>
        </div>
      )}

      <Tabs tab={tab} onTabChange={setTab} />

      <div style={{ display: tab === "workout" ? "block" : "none" }}>
        <WorkoutTab unit={unit} onLoadOnBar={loadOnBar} />
      </div>
      <div style={{ display: tab === "plates" ? "block" : "none" }}>
        <PlatesTab unit={unit} preset={platePreset} />
      </div>
      <div style={{ display: tab === "food" ? "block" : "none" }}>
        <FoodTab unit={unit} />
      </div>

      <div className="footer-note">
        <b>Ironlog</b> · saved on this device
      </div>
    </div>
  );
}
