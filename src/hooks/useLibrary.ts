import { useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { DEFAULT_EXERCISES } from "../data/exercises";
import type { Exercise } from "../lib/types";
import { uid } from "../lib/format";

export function useLibrary() {
  const [custom, setCustom] = useLocalStorage<Exercise[]>("ironlog.customExercises", []);
  const [deleted, setDeleted] = useLocalStorage<string[]>("ironlog.deletedExercises", []);

  const library = useMemo<Exercise[]>(() => {
    const builtins = DEFAULT_EXERCISES.filter((e) => !deleted.includes(e.id));
    return [...builtins, ...custom];
  }, [custom, deleted]);

  function addExercise(name: string, group: string) {
    const ex: Exercise = { id: uid(), name, group, isCustom: true };
    setCustom((prev) => [...prev, ex]);
    return ex;
  }

  function deleteExercise(id: string) {
    if (custom.some((e) => e.id === id)) {
      setCustom((prev) => prev.filter((e) => e.id !== id));
    } else {
      setDeleted((prev) => [...prev, id]);
    }
  }

  return { library, addExercise, deleteExercise };
}
