// Panini sticker card for an AI "prophet" (homepage + The Prophets page):
// halftone monogram portrait, name, role, and league stats.

import { getAIMeta } from "@/lib/ai-meta";
import { pct } from "@/lib/prophets";
import type { ProphetRow } from "@/lib/prophets";

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
  return (
    <article className="sticker">
      <span className="sticker__no">{meta.no}</span>
      <span className="sticker__crest">★ ORACLE XI</span>
      <div className="sticker__portrait">
        <span className="sticker__mono">{meta.short}</span>
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
    </article>
  );
}
