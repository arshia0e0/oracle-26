// A stat number in the ORACLE mono "data readout" style. The real value is
// rendered in the server HTML — crawlers, no-JS visitors, screen readers and
// reduced-motion users always see the correct number. For everyone else the
// visible digits roll up from zero the first time they scroll into view,
// while an sr-only copy of the final value keeps assistive tech from ever
// announcing a mid-animation frame.

"use client";

import { animate, useInView } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

// Visually hidden but exposed to screen readers (the classic sr-only recipe).
const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export default function CountUp({
  value,
  duration = 1.2,
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  // Starts at the final value so the server HTML and the hydration render
  // both show the real number — no mismatch and no flash of zero.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  // tabular-nums keeps the width steady so the roll doesn't jitter the layout
  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <span aria-hidden="true">
        {display}
        {suffix}
      </span>
      <span style={SR_ONLY}>
        {value}
        {suffix}
      </span>
    </span>
  );
}
