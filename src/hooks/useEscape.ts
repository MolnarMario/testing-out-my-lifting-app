import { useEffect } from "react";

/** Calls `onEscape` when Escape is pressed anywhere in the document. */
export function useEscape(onEscape: () => void) {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onEscape]);
}
