import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { DEFAULT_EXERCISES } from "../data/exercises";
import { slugify, uid } from "../lib/format";
import type { Exercise } from "../lib/types";

/** Only entries with an id and a name are exercises; anything else is dropped. */
function normalizeCustom(raw: unknown): Exercise[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is Exercise =>
      typeof e === "object" && e !== null && typeof e.id === "string" && typeof e.name === "string",
  ).map((e) => ({ ...e, group: typeof e.group === "string" ? e.group : "Other" }));
}

function normalizeIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

export function useLibrary() {
  const [custom, setCustom] = useLocalStorage<Exercise[]>("ironlog.custom", [], normalizeCustom);
  const [removed, setRemoved] = useLocalStorage<string[]>("ironlog.removed", [], normalizeIds);

  const library = useMemo<Exercise[]>(() => {
    const builtins = DEFAULT_EXERCISES.filter((e) => !removed.includes(e.id));
    return [...builtins, ...custom];
  }, [custom, removed]);

  /**
   * The id is the name's slug, so it stays stable and readable. Two different
   * names can still share a slug ("Pull up" and "Pull-up"), and a name with no
   * letters at all has none, so either case gets a random suffix rather than
   * being silently dropped as a duplicate.
   */
  const addExercise = useCallback(
    (exercise: Omit<Exercise, "id" | "isCustom">) => {
      const slug = slugify(exercise.name);
      const taken = (id: string) => custom.some((e) => e.id === id);
      let id = "cx-" + (slug === "" ? uid() : slug);
      while (taken(id)) id = `cx-${slug}-${uid().slice(0, 4)}`;

      setCustom((prev) => [...prev, { ...exercise, id, isCustom: true }]);
      return id;
    },
    [custom, setCustom],
  );

  /** Custom exercises are dropped; built-ins are only hidden, so they can come back. */
  const removeExercise = useCallback(
    (id: string) => {
      if (custom.some((e) => e.id === id)) {
        setCustom((prev) => prev.filter((e) => e.id !== id));
      } else {
        setRemoved((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }
    },
    [custom, setCustom, setRemoved],
  );

  const restoreHidden = useCallback(() => setRemoved([]), [setRemoved]);

  return { library, custom, removed, addExercise, removeExercise, restoreHidden };
}
