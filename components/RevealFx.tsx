// Re-runs the ORACLE entrance stagger on every route change: each
// .reveal element gets a small animation delay and the .in class.
// Opacity is never animated, so content can't stick hidden.

"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function RevealFx() {
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    els.forEach((el, i) => {
      el.classList.remove("in");
      el.style.animationDelay = `${Math.min(i, 14) * 0.05}s`;
    });
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        els.forEach((el) => el.classList.add("in"))
      )
    );
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
