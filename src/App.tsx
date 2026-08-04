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
import { migrationAvailable, runMigration } from "./lib/migrate";
import type { MigrationReport } from "./lib/migrate";
import type { TabKey } from "./lib/types";

export default function App() {
  const [tab, setTab] = useState<TabKey>("workout");
  const [unit, setUnit] = useUnit();
  const persistenceBroken = usePersistenceBroken();
  const [platePreset, setPlatePreset] = useState<PlatePreset | null>(null);
  const [canImport, setCanImport] = useState(() => migrationAvailable());
  const [imported, setImported] = useState<MigrationReport | null>(null);

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

      {canImport && (
        <div className="warn-banner" role="status" style={{ borderColor: "var(--accent-line)" }}>
          <TriangleAlert aria-hidden="true" />
          <span>
            Training data from the old version of Ironlog is on this device. Import it? Your
            original data is left in place either way.
          </span>
          <button
            className="btn btn-primary"
            style={{ flex: "0 0 auto", padding: "8px 14px" }}
            onClick={() => {
              setImported(runMigration());
              setCanImport(false);
            }}
          >
            Import
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: "0 0 auto", padding: "8px 14px" }}
            onClick={() => setCanImport(false)}
          >
            Not now
          </button>
        </div>
      )}

      {imported?.ran && (
        <div className="warn-banner" role="status" style={{ borderColor: "var(--border-2)" }}>
          <span>
            Imported {imported.days} {imported.days === 1 ? "day" : "days"} and {imported.sets}{" "}
            {imported.sets === 1 ? "set" : "sets"}
            {imported.foodDays > 0 && `, plus ${imported.foodDays} days of food`}.
            {imported.unmatchedExercises.length > 0 && (
              <>
                {" "}
                Skipped sets for {imported.unmatchedExercises.length} unrecognised{" "}
                {imported.unmatchedExercises.length === 1 ? "exercise" : "exercises"}:{" "}
                {imported.unmatchedExercises.join(", ")}.
              </>
            )}{" "}
            Reload to see it.
          </span>
          <button
            className="btn btn-primary"
            style={{ flex: "0 0 auto", padding: "8px 14px" }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
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
