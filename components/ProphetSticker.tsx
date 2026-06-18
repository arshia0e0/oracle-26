// Panini sticker card for an AI "prophet" (homepage + The Prophets page):
// halftone monogram portrait, name, role, and league stats.
//
// Interactive "machine" treatment (its own style, distinct from the players'
// holographic foil): the card tilts in 3D toward the cursor and a green→cyan
// data-sheen with faint scanlines tracks the pointer — an AI-screen feel.
// Multiply blending makes the tint read on the white sticker stock. Falls
// back to a plain card under prefers-reduced-motion.

"use client";

import { useRef } from "react";
import ProphetAvatar from "@/components/ProphetAvatar";
import { getAIMeta } from "@/lib/ai-meta";
import type { ProphetRow } from "@/lib/prophets";

const MAX_TILT = 8; // degrees

// Inlined from lib/prophets to keep this client component off the db-bound
// module graph (importing prophets.ts pulls Prisma/better-sqlite3 → fs).
function pct(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

export function FormDots({ form }: { form: ("w" | "d" | "l")[] }) {
  if (form.length === 0) {
    return <span className="stat__lab">No matches scored yet</span>;
  }
  return (
    <span className="form-dots">
      {form.map((f, i) => (
        <i key={i} className={`fd-${f}`} />
      ))}
    </span>
  );
}

export default function ProphetSticker({ row }: { row: ProphetRow }) {
  const meta = getAIMeta(row.aiModel);
  const ref = useRef<HTMLElement>(null);

  function onMove(e: React.MouseEvent<HTMLElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    // tilt: top → away, cursor pulls the near edge up
    el.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 2 * MAX_TILT}deg`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  }

  return (
    <article
      className="sticker sticker--fx"
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <span className="sticker__no">{meta.no}</span>
      <span className="sticker__crest">★ ORACLE XI</span>
      <div className="sticker__portrait">
        <ProphetAvatar name={meta.name} short={meta.short} />
        <div className="sticker__band">
          <span>{meta.org}</span>
          <span>’26</span>
        </div>
      </div>
      <h3 className="sticker__name">{meta.name}</h3>
      <p className="sticker__role">{meta.role}</p>
      <div className="sticker__stats">
        <div className="stat">
          <span className="stat__num">
            {pct(row.winnerCorrect, row.matchesPredicted)}
          </span>
          <span className="stat__lab">Accuracy</span>
        </div>
        <div className="stat">
          <span className="stat__num">{row.perfectPredictions}</span>
          <span className="stat__lab">Exact Scores</span>
        </div>
        <div className="stat" style={{ gridColumn: "1 / -1" }}>
          <FormDots form={row.form} />
          <span className="stat__lab" style={{ marginTop: 4 }}>
            Last 5
          </span>
        </div>
      </div>
      <span className="sticker__fx" aria-hidden="true" />
    </article>
  );
}
