import { useMemo, useState } from "react";
import { ScanLine } from "lucide-react";
import { FOOD_CATEGORIES, buildFood } from "../../lib/food";
import type { Food, FoodCategory, FoodType } from "../../lib/food";

interface Props {
  pantry: Food[];
  onAdd: (food: Food) => void;
  onRemove: (id: string) => void;
  onOpenScan: () => void;
}

const MACRO_FIELDS = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
] as const;

type MacroKey = (typeof MACRO_FIELDS)[number]["key"];
type Draft = Record<MacroKey, string>;

const EMPTY_DRAFT: Draft = { kcal: "", protein: "", carbs: "", fat: "", fiber: "" };

export function PantryPane({ pantry, onAdd, onRemove, onOpenScan }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cat, setCat] = useState<FoodCategory>("Other");
  const [type, setType] = useState<FoodType>("solid");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q === "" ? pantry : pantry.filter((f) => f.name.toLowerCase().includes(q));
    return FOOD_CATEGORIES.map((c) => ({
      cat: c,
      items: matches.filter((f) => f.cat === c),
    })).filter((g) => g.items.length > 0);
  }, [pantry, query]);

  const selected = pantry.find((f) => f.id === selectedId) ?? null;

  function submit() {
    const result = buildFood({ name, cat, type, ...draft }, pantry);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onAdd(result.food);
    setName("");
    setDraft(EMPTY_DRAFT);
    setError("");
  }

  const basis = (f: Food) => (f.type === "liquid" ? "per 100 ml" : "per 100 g");

  return (
    <div className="mc-pane">
      <div className="card">
        <div className="card-head" style={{ marginBottom: 4 }}>
          <span className="card-title">Add food</span>
          <button type="button" className="modal-head-btn" onClick={onOpenScan}>
            <ScanLine aria-hidden="true" />
            Scan label
          </button>
        </div>
        <p className="modal-note">
          Enter the numbers as they appear on the label, per 100 g or 100 ml — or photograph
          the label and let the scanner read them.
        </p>

        <div className="add-ex-form">
          <div className="field grow">
            <span className="field-label">Name</span>
            <input
              className="text-input"
              value={name}
              placeholder="Greek yoghurt 2%"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field shrink">
            <span className="field-label">Category</span>
            <select
              className="lib-select"
              value={cat}
              onChange={(e) => setCat(e.target.value as FoodCategory)}
            >
              {FOOD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="field shrink">
            <span className="field-label">Measured by</span>
            <div className="seg subtle">
              {(["solid", "liquid"] as const).map((t) => (
                <button
                  key={t}
                  className={type === t ? "seg-opt on" : "seg-opt"}
                  onClick={() => setType(t)}
                >
                  {t === "solid" ? "g" : "ml"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mc-grid2" style={{ marginTop: 12 }}>
          {MACRO_FIELDS.map(({ key, label, unit }) => (
            <div className="field" key={key}>
              <span className="field-label">{label}</span>
              <div className="mc-numwrap">
                <input
                  className="text-input"
                  inputMode="decimal"
                  placeholder="0"
                  value={draft[key]}
                  aria-label={`${label} per 100`}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "" || /^\d*\.?\d*$/.test(next)) {
                      setDraft((prev) => ({ ...prev, [key]: next }));
                    }
                  }}
                />
                <span className="unit">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {error !== "" && <p className="hint">{error}</p>}

        <div className="add-bar">
          <button className="btn btn-primary" onClick={submit}>
            Add to pantry
          </button>
        </div>
      </div>

      <div className="search" style={{ borderBottom: 0, padding: "0 0 12px" }}>
        <input
          className="text-input"
          value={query}
          placeholder="Search the pantry"
          aria-label="Search the pantry"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {selected && (
        <div className="mc-food" style={{ marginBottom: 14 }}>
          <div className="mc-food-top">
            <span className="mc-food-name">{selected.name}</span>
            <span className="mc-food-basis">{basis(selected)}</span>
          </div>
          <div className="mc-food-macros">
            <span className="mc-chip kc">
              <b>{selected.kcal}</b> kcal
            </span>
            <span className="mc-chip">
              <b>{selected.protein}</b> g protein
            </span>
            <span className="mc-chip">
              <b>{selected.carbs}</b> g carbs
            </span>
            <span className="mc-chip">
              <b>{selected.fat}</b> g fat
            </span>
            <span className="mc-chip">
              <b>{selected.fiber}</b> g fiber
            </span>
          </div>
          <div className="mc-food-actions">
            <button className="mc-mini" onClick={() => setSelectedId(null)}>
              Close
            </button>
            <button
              className="mc-mini danger"
              onClick={() => {
                onRemove(selected.id);
                setSelectedId(null);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="mc-foodgroups">
        {groups.length === 0 ? (
          <div className="mc-empty">
            <span className="mc-pin">Nothing found</span>
            No food matches “{query}”.
          </div>
        ) : (
          groups.map(({ cat: group, items }) => (
            <div key={group}>
              <div className="mc-seclab">
                {group}
                <span className="mc-ct">{items.length}</span>
              </div>
              <div className="mc-fgrid">
                {items.map((f) => (
                  <button
                    type="button"
                    className="mc-fchip"
                    key={f.id}
                    onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
                  >
                    <span className="nm">{f.name}</span>
                    <span className="kc">{Math.round(f.kcal)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
