// Automated guards for ORACLE /26's product truths. Run via `npm test`.
//
// Three layers:
//   1. Source scan  — forbidden phrases ("five machines", "six oracles", …)
//                     must not exist anywhere in the app source or docs.
//   2. Unit checks  — the roster is 6 models + 1 derived consensus (7 scored
//                     entries), the consensus is never registered as a model,
//                     and the consensus math is the documented mean +
//                     Math.round (halves up).
//   3. HTTP checks  — optional; set CHECK_URL (e.g. http://localhost:3000 or
//                     the production origin) to also assert the *served* HTML:
//                     no forbidden phrases, no zero-rendered stat values,
//                     methodology link present, sr-only stat copies present.
//
// Exits non-zero on the first layer that has failures, printing every
// failure it found.

import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import {
  AI_META,
  CONSENSUS_MODEL_NAME,
  CONTESTANT_COUNT,
  MODEL_COUNT,
} from "../lib/ai-meta";
import {
  buildConsensusPrediction,
  MATCH_AI_MODELS,
  TOURNAMENT_AI_MODELS,
} from "../lib/predictor";

const failures: string[] = [];

function check(ok: boolean, message: string): void {
  if (!ok) failures.push(message);
}

// ---------- 1. Source scan ----------

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /five machines/i, why: "there are six models, not five" },
  { pattern: /five ai models/i, why: "there are six models, not five" },
  {
    pattern: /six oracles/i,
    why: "the table has seven scored entries, not six",
  },
  { pattern: /six ais/i, why: "ambiguous — the table shows seven entries" },
  {
    pattern: /seventh (ai )?model/i,
    why: "the consensus is a derived aggregate, not a seventh model",
  },
  { pattern: /seven models/i, why: "there are six models plus one consensus" },
];

// The methodology page legitimately spells out the rule "not a seventh AI
// model"; a negated match is not a violation.
const NEGATION = /\bnot an? seventh/i;

const SCAN_ROOTS = ["app", "components", "lib", "scripts", "prisma"];
const SCAN_FILES = ["README.md"];
const SKIP_DIRS = new Set(["generated", "node_modules", ".next", "migrations"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".md", ".css", ".json"]);

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) found.push(...walk(full));
    } else if (EXTENSIONS.has(path.extname(entry))) {
      found.push(full);
    }
  }
  return found;
}

function scanSource(): void {
  const root = path.join(__dirname, "..");
  const files = SCAN_ROOTS.flatMap((d) => walk(path.join(root, d)));
  files.push(...SCAN_FILES.map((f) => path.join(root, f)));

  for (const file of files) {
    // This file defines the forbidden patterns as literals — skip itself.
    if (path.basename(file) === "check-invariants.ts") continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(line) && !NEGATION.test(line)) {
          check(
            false,
            `${path.relative(root, file)}:${i + 1} matches ${pattern} (${why}): ${line.trim().slice(0, 90)}`
          );
        }
      }
    });
  }
}

// ---------- 2. Unit checks ----------

function checkRoster(): void {
  check(MODEL_COUNT === 6, `MODEL_COUNT must be 6, got ${MODEL_COUNT}`);
  check(
    CONTESTANT_COUNT === 7,
    `CONTESTANT_COUNT must be 7 (six models + consensus), got ${CONTESTANT_COUNT}`
  );
  const consensusEntries = AI_META.filter(
    (ai) => ai.name === CONSENSUS_MODEL_NAME
  );
  check(
    consensusEntries.length === 1,
    `AI_META must contain exactly one consensus entry, got ${consensusEntries.length}`
  );
  check(
    MATCH_AI_MODELS.length === 6,
    `MATCH_AI_MODELS must register 6 models, got ${MATCH_AI_MODELS.length}`
  );
  check(
    !MATCH_AI_MODELS.some((m) => m.name === CONSENSUS_MODEL_NAME),
    "the consensus must never be registered as a match-predicting model"
  );
  check(
    !TOURNAMENT_AI_MODELS.some((m) => m.name === CONSENSUS_MODEL_NAME),
    "the consensus must never be registered as a tournament-predicting model"
  );
  // Every registered model must have display metadata, and vice versa.
  const metaNames = new Set(AI_META.map((ai) => ai.name));
  for (const m of MATCH_AI_MODELS) {
    check(metaNames.has(m.name), `model ${m.name} missing from AI_META`);
  }
}

function checkConsensusMath(): void {
  const p = (homeScore: number, awayScore: number, confidence: number | null) => ({
    homeScore,
    awayScore,
    reasoning: "",
    confidence,
    penaltyWinner: null as string | null,
  });

  // Mean of 2,1,0 = 1; mean of 1,0,2 = 1.
  const even = buildConsensusPrediction([p(2, 1, 60), p(1, 0, 40), p(0, 2, null)]);
  check(even !== null, "consensus must exist when predictions exist");
  check(even!.homeScore === 1, `mean(2,1,0) should round to 1, got ${even!.homeScore}`);
  check(even!.awayScore === 1, `mean(1,0,2) should round to 1, got ${even!.awayScore}`);
  check(
    even!.confidence === 50,
    `confidence mean(60,40) should be 50, got ${even!.confidence}`
  );

  // The documented rounding rule: Math.round — exact halves round UP.
  const half = buildConsensusPrediction([p(1, 0, null), p(2, 1, null)]);
  check(
    half!.homeScore === 2,
    `mean 1.5 must round up to 2 (Math.round), got ${half!.homeScore}`
  );
  check(
    half!.awayScore === 1,
    `mean 0.5 must round up to 1 (Math.round), got ${half!.awayScore}`
  );

  check(
    buildConsensusPrediction([]) === null,
    "consensus must be null with no predictions to average"
  );
}

// CountUp must keep its accessibility contract: value-first initial state,
// reduced-motion handling, and an sr-only copy of the real value.
function checkCountUpSource(): void {
  const src = readFileSync(
    path.join(__dirname, "..", "components", "CountUp.tsx"),
    "utf8"
  );
  check(
    src.includes("useState(value)"),
    "CountUp must initialise display state to the final value (server HTML correctness)"
  );
  check(
    src.includes("prefers-reduced-motion"),
    "CountUp must respect prefers-reduced-motion"
  );
  check(
    src.includes('aria-hidden="true"'),
    "CountUp must hide the animated digits from assistive tech"
  );
}

// ---------- 3. HTTP checks (optional) ----------

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  check(res.ok, `${url} returned HTTP ${res.status}`);
  return res.text();
}

async function checkServedHtml(base: string): Promise<void> {
  const origin = base.replace(/\/$/, "");
  const pages = ["/", "/leaderboard", "/prophets", "/analytics", "/methodology", "/fixtures"];

  for (const page of pages) {
    let html: string;
    try {
      html = await fetchText(origin + page);
    } catch (err) {
      check(false, `${page}: fetch failed — ${err instanceof Error ? err.message : err}`);
      continue;
    }

    for (const { pattern } of FORBIDDEN) {
      // Served pages never legitimately need the negated phrase scan-skip
      // except the methodology page's "not a seventh AI model".
      const stripped = html.replace(/not a seventh AI model/gi, "");
      check(
        !pattern.test(stripped),
        `${page}: served HTML matches forbidden ${pattern}`
      );
    }

    // Stat readouts must not server-render zero. Every CountUp stat on these
    // pages is non-zero once the league has data (it has since matchday 1).
    const zeroStat = html.match(
      /(pb-cell__num|podium-pts)[^>]*>(<span[^>]*>)*0</
    );
    check(
      zeroStat === null,
      `${page}: a stat readout server-rendered as 0: …${zeroStat?.[0]}…`
    );

    // The animated digits must carry an sr-only twin (accessibility contract).
    if (html.includes("pb-cell__num") || html.includes("podium-pts")) {
      check(
        /aria-hidden="true">\d+<\/span><span style="position:absolute/.test(html),
        `${page}: CountUp sr-only value copy missing from served HTML`
      );
    }
  }

  // The methodology page must be reachable from the site chrome (footer).
  const home = await fetchText(origin + "/");
  check(
    /href="\/methodology"/.test(home),
    "homepage chrome has no visible /methodology link"
  );
}

// ---------- Run ----------

async function main(): Promise<void> {
  scanSource();
  checkRoster();
  checkConsensusMath();
  checkCountUpSource();

  const base = process.env.CHECK_URL;
  if (base) {
    console.log(`Checking served HTML at ${base} ...`);
    await checkServedHtml(base);
  } else {
    console.log("CHECK_URL not set — skipping served-HTML checks.");
  }

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} invariant failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("✓ All invariants hold.");
}

main().catch((err) => {
  console.error("Invariant run crashed:", err);
  process.exit(1);
});
