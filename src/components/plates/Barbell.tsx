import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SHAFT_LEN, plateModifierClass } from "../../lib/plates";
import type { LoadedPlate, RigDims } from "../../lib/plates";

interface Props {
  dims: RigDims;
  plates: LoadedPlate[];
  hasCollar: boolean;
  /** lb collars are the snap-on kind, and sit differently on the sleeve. */
  snapCollar: boolean;
}

export function Barbell({ dims, plates, hasCollar, snapCollar }: Props) {
  const stageRef = useRef<HTMLElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // The rig is drawn at a fixed natural size, then scaled to whatever room the
  // stage has. Capped at 1.25 so a wide desktop does not blow it up absurdly.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const rig = rigRef.current;
      const rigW = rig ? rig.offsetWidth : SHAFT_LEN + dims.collarW + dims.sleeveLen;
      const rigH = rig ? rig.offsetHeight : dims.plateMax;
      const availW = stage.clientWidth - 30;
      const availH = stage.clientHeight - 24;
      if (rigW > 0 && rigH > 0 && availW > 0 && availH > 0) {
        setScale(Math.min(availW / rigW, availH / rigH, 1.25));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    if (rigRef.current) observer.observe(rigRef.current);
    return () => observer.disconnect();
  }, [dims]);

  const rigStyle = {
    "--bar-th": `${dims.barTh}px`,
    "--sleeve-th": `${dims.sleeveTh}px`,
    "--sleeve-len": `${dims.sleeveLen}px`,
    "--ring-mark": `${dims.ringMark}px`,
    "--collar-face-w": `${dims.collarW}px`,
    height: `${dims.plateMax}px`,
    transform: `translate(-50%, -50%) scale(${scale})`,
  } as CSSProperties;

  // Flatten pairs into individual discs so each can animate in turn.
  let index = 0;
  const discs = plates.flatMap(({ plate, count }) =>
    Array.from({ length: count }, (_, i) => ({
      key: `${plate.label}-${i}`,
      plate,
      delay: index++ * 0.03,
    })),
  );

  return (
    <section className="pl-stage" ref={stageRef} aria-label="Loaded barbell, one sleeve shown">
      <div className="pl-glow" aria-hidden="true" />

      <div className="pl-rig" ref={rigRef} style={rigStyle}>
        <div className="pl-shaft" aria-hidden="true" />
        <div className="pl-sleeve" aria-hidden="true" />

        <div
          className={
            "pl-loadrow" + (discs.length > 0 ? " is-loaded" : "") + (hasCollar ? " has-collar" : "")
          }
        >
          <span className="pl-collar-face" aria-hidden="true" />

          <div className="pl-plates">
            {discs.map(({ key, plate, delay }) => (
              <div
                key={key}
                className={"pl-plate" + plateModifierClass(plate)}
                title={plate.label}
                style={
                  {
                    "--c": plate.color,
                    width: `${plate.w}px`,
                    height: `${plate.h}px`,
                    animationDelay: `${delay}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <span
            className={"pl-collar" + (snapCollar ? " pl-collar--snap" : "")}
            aria-hidden="true"
          >
            <span className="pl-collar-band" />
            <span className="pl-collar-body">
              <span className="pl-collar-lever">
                <span className="pl-collar-pin" />
              </span>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
