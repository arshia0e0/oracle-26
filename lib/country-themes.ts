// National tints used for team accents on cards and the predicted-champion
// sticker. Keyed by country name as stored on Team.name; countries not listed
// fall back to a neutral pitch tone. (t1 = primary, t2 = secondary.)
export const COUNTRY_THEMES: Record<string, { t1: string; t2: string }> = {
  Argentina: { t1: "#75c2ee", t2: "#f5d77a" },
  Portugal: { t1: "#d6293c", t2: "#1d8a4e" },
  Norway: { t1: "#c8102e", t2: "#9fd4ff" },
  Brazil: { t1: "#f6d000", t2: "#1f9d4d" },
  Belgium: { t1: "#f4c20d", t2: "#ed2939" },
  Netherlands: { t1: "#ff7a1a", t2: "#3450a3" },
  Spain: { t1: "#e63232", t2: "#f4c20d" },
  France: { t1: "#3a5bd9", t2: "#ef4135" },
  England: { t1: "#cf2435", t2: "#dfe8f5" },
  Germany: { t1: "#f4c20d", t2: "#d6293c" },
};

// Primary accent colour for a team name, or a neutral hairline tone.
export function teamAccent(name: string): string {
  return COUNTRY_THEMES[name]?.t1 ?? "#16321f";
}
