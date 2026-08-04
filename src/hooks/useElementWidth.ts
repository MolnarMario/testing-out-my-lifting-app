import { useLayoutEffect, useRef, useState } from "react";

/**
 * The rendered width of an element, tracked as it changes.
 *
 * Charts are drawn at their real pixel size rather than scaled from a fixed
 * viewBox: a scaled viewBox would stretch the 2px strokes and the axis type
 * along with the plot. Starts at 0 so nothing is drawn until a real width is
 * known — an SVG sized from a guess flashes at the wrong scale on first paint.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setWidth(el.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
