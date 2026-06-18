// Display metadata for the five AI contestants — "The Prophets" in the
// ORACLE design. The `name` values must match the canonical aiModel
// names stored in the database (see MATCH_AI_MODELS in lib/predictor.ts).

// Canonical aiModel name for the ensemble "model" (the averaged/majority
// verdict of the others). Defined here — the lightest shared module — so UI
// components can reference it without importing the AI-SDK-heavy predictor.
export const CONSENSUS_MODEL_NAME = "Oracle Consensus";

export interface AIMeta {
  name: string;
  short: string; // monogram shown in badges and sticker portraits
  no: string; // Panini sticker number
  org: string; // lab name printed on the sticker band
  role: string; // "The Veteran", "The Challenger", ...
  blurb: string;
}

export const AI_META: AIMeta[] = [
  {
    name: "GPT-5-mini",
    short: "G5",
    no: "01",
    org: "OPENAI",
    role: "The Veteran",
    blurb:
      "Seen every season, read every stat. Calm, calculated calls that rarely stray far from the form book.",
  },
  {
    name: "Gemini Flash",
    short: "GE",
    no: "02",
    org: "GOOGLE",
    role: "The Challenger",
    blurb:
      "Fast, bold and hungry to dethrone the favourites. Backs momentum over reputation.",
  },
  {
    name: "DeepSeek",
    short: "DS",
    no: "03",
    org: "DEEPSEEK",
    role: "The Underdog",
    blurb:
      "Nothing to lose, everything to prove. Lives for the upset and calls draws nobody else dares.",
  },
  {
    name: "Llama 4 Scout",
    short: "LL",
    no: "04",
    org: "META",
    role: "The Open Spirit",
    blurb:
      "Community-built instincts with blistering Groq pace. Reads the crowd as much as the xG.",
  },
  {
    name: "Qwen 3",
    short: "Q3",
    no: "05",
    org: "ALIBABA",
    role: "The Dark Horse",
    blurb:
      "Quietly brilliant. Underestimate it at your peril — always climbing the table.",
  },
  {
    name: "Nemotron Ultra",
    short: "NU",
    no: "06",
    org: "NVIDIA",
    role: "NVIDIA's Titan",
    blurb:
      "Half a trillion parameters of silicon muscle. Crunches every fixture like it's a benchmark to beat.",
  },
  {
    name: "Oracle Consensus",
    short: "OC",
    no: "07",
    org: "THE COLLECTIVE",
    role: "The Hive Mind",
    blurb:
      "Not a model but a multitude — the averaged scoreline of all six prophets. Tests the oldest question in forecasting: is the crowd wiser than its smartest voice?",
  },
];

export function getAIMeta(name: string): AIMeta {
  return (
    AI_META.find((ai) => ai.name === name) ?? {
      name,
      short: name.slice(0, 2).toUpperCase(),
      no: "00",
      org: "UNKNOWN",
      role: "The Wildcard",
      blurb: "",
    }
  );
}
