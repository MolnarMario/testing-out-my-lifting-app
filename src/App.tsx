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

/** Carries the import summary across the reload that follows an import. */
const REPORT_KEY = "ironlog.migration-report";

/** The summary left by an import just before this page load, read once. */
function takeReport(): MigrationReport | null {
  try {
    const raw = window.sessionStorage.getItem(REPORT_KEY);
    window.sessionStorage.removeItem(REPORT_KEY);
    return raw === null ? null : (JSON.parse(raw) as MigrationReport);
  } catch {
    return null;
  }
}

// Taken at module load rather than in a state initialiser: StrictMode runs
// initialisers twice, and the second run would find the report already gone.
const pendingReport = takeReport();

/**
 * The import writes straight to localStorage, behind the in-memory stores every
 * hook reads from. Any write before a reload would serialise those stale stores
 * over the imported data, so a successful import reloads at once and shows its
 * summary on the other side. Losing the summary (sessionStorage refused) is
 * acceptable; losing the data is not.
 */
function importLegacy(): MigrationReport {
  const report = runMigration();
  if (!report.ran) return report;
  try {
    window.sessionStorage.setItem(REPORT_KEY, JSON.stringify(report));
  } catch {
    // Reload regardless.
  }
  window.location.reload();
  return report;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("workout");
  const [unit, setUnit] = useUnit();
  const persistenceBroken = usePersistenceBroken();
  const [platePreset, setPlatePreset] = useState<PlatePreset | null>(null);
  const [canImport, setCanImport] = useState(() => migrationAvailable());
  const [imported, setImported] = useState<MigrationReport | null>(pendingReport);

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
            Training data from the old version of Ironlog is on this device. Import it? A copy of
            the original is kept on this device first, so nothing is lost either way.
          </span>
          <button
            className="btn btn-primary"
            style={{ flex: "0 0 auto", padding: "8px 14px" }}
            onClick={() => {
              setImported(importLegacy());
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
            {imported.foodDays > 0 &&
              `, plus ${imported.foodEntries} food ${imported.foodEntries === 1 ? "entry" : "entries"} over ${imported.foodDays} ${imported.foodDays === 1 ? "day" : "days"}`}
            .
            {imported.createdExercises.length > 0 && (
              <>
                {" "}
                Added {imported.createdExercises.length === 1 ? "an exercise" : "exercises"} the
                library did not have: {imported.createdExercises.join(", ")}.
              </>
            )}
            {imported.skippedSets > 0 && (
              <>
                {" "}
                {imported.skippedSets} {imported.skippedSets === 1 ? "set had" : "sets had"} no reps
                and stayed in the backup.
              </>
            )}
            {imported.leftBehind.length > 0 && (
              <> The new version has no place for {imported.leftBehind.join(" or ")}; those stay in the backup.</>
            )}
          </span>
          <button
            className="btn btn-ghost"
            style={{ flex: "0 0 auto", padding: "8px 14px" }}
            onClick={() => setImported(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {imported !== null && !imported.ran && (
        <div className="warn-banner" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>The import did not finish ({imported.reason}). Nothing was lost: the original data is
            still on this device.</span>
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
