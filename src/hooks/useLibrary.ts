import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { DEFAULT_EXERCISES } from "../data/exercises";
import type { Exercise } from "../lib/types";

export function useLibrary() {
  const [custom, setCustom] = useLocalStorage<Exercise[]>("ironlog.custom", []);
  const [removed, setRemoved] = useLocalStorage<string[]>("ironlog.removed", []);

  const library = useMemo<Exercise[]>(() => {
    const builtins = DEFAULT_EXERCISES.filter((e) => !removed.includes(e.id));
    return [...builtins, ...custom];
  }, [custom, removed]);

  const addExercise = useCallback(
    (exercise: Omit<Exercise, "id" | "isCustom">) => {
      const id =
        "cx-" +
        exercise.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      setCustom((prev) =>
        prev.some((e) => e.id === id) ? prev : [...prev, { ...exercise, id, isCustom: true }],
      );
      return id;
    },
    [setCustom],
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
