// Live countdown to the next kick-off in the ORACLE countdown-slab style.
// Renders zeroed digits on the server and during hydration, then the
// real numbers take over client-side — no hydration mismatch.

"use client";

import { Fragment, useEffect, useState } from "react";

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function partsUntil(target: number): Parts {
  const total = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export default function HeroCountdown({
  targetIso,
  venueLine,
}: {
  targetIso: string;
  venueLine: string;
}) {
  const target = new Date(targetIso).getTime();
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    setParts(partsUntil(target));
    const timer = setInterval(() => setParts(partsUntil(target)), 1000);
    return () => clearInterval(timer);
  }, [target]);

  const { days, hours, minutes, seconds } = parts ?? {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };
  const units: [number, string][] = [
    [days, "Days"],
    [hours, "Hrs"],
    [minutes, "Min"],
    [seconds, "Sec"],
  ];

  return (
    <div className="countdown reveal">
      <div>
        <span className="eyebrow">First Whistle In</span>
        <div className="countdown__clock" style={{ marginTop: "1rem" }}>
          {units.map(([value, label], i) => (
            <Fragment key={label}>
              <div className="cd-unit">
                <span className="cd-unit__num data">
                  {String(value).padStart(2, "0")}
                </span>
                <span className="cd-unit__lab">{label}</span>
              </div>
              {i < units.length - 1 && <span className="cd-sep">:</span>}
            </Fragment>
          ))}
        </div>
      </div>
      <span className="label-mono">{venueLine}</span>
    </div>
  );
}
