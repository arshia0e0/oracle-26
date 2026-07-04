// Builds match-prediction prompts and queries five AI models
// (Gemini, GPT, DeepSeek R1, Llama, Qwen) for exact-score predictions.
//
// Requires in .env: GEMINI_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY
// (official DeepSeek platform key), GROQ_API_KEY (serves Llama and Qwen)

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { Match, Player, Team } from "./generated/prisma/client";
import { normalizeName } from "./scoring";

export interface MatchPrediction {
  homeScore: number;
  awayScore: number;
  reasoning: string;
  // Model's self-reported confidence in this scoreline, 0–100. Null when a
  // model didn't return one (e.g. predictions made before this field existed).
  confidence: number | null;
  // For a predicted draw in a knockout tie, the name of the team the model
  // expects to win the penalty shootout, exactly as it returned it. Null for
  // decisive scorelines and group-stage draws. Mapped to a "HOME"/"AWAY" side
  // at store time (lib/daily-update.ts), where the team names are known.
  penaltyWinner: string | null;
}

export interface TournamentOutcome {
  winner: string;
  goldenBoot: string;
  goldenGlove: string;
  goldenBall: string;
  reasoning: string;
}

// ---------- Prompt building ----------

function formatPlayers(players: Player[]): string {
  if (players.length === 0) return "Unknown";
  return players.map((p) => `${p.name} (${p.position})`).join(", ");
}

export function buildMatchPrompt(
  match: Match,
  homeTeam: Team,
  awayTeam: Team,
  homePlayers: Player[],
  awayPlayers: Player[]
): string {
  // Group matches can end level; knockout ties cannot — if the model calls a
  // draw it must also say who wins the shootout, which decides the winner point.
  const isKnockout = match.stage !== "GROUP";
  const knockoutNote = isKnockout
    ? `\nThis is a knockout match — it cannot end in a draw. Give the score at the end of play (regulation plus extra time). If that score is level (a draw), you MUST also set "penaltyWinner" to the name of the team you expect to win the penalty shootout — exactly "${homeTeam.name}" or "${awayTeam.name}".`
    : "";
  const jsonShape = isKnockout
    ? `{"homeScore": number, "awayScore": number, "penaltyWinner": "${homeTeam.name}" | "${awayTeam.name}" | null (only when you predicted a draw), "confidence": number (0-100, how sure you are of this exact scoreline), "reasoning": "one sentence"}`
    : `{"homeScore": number, "awayScore": number, "confidence": number (0-100, how sure you are of this exact scoreline), "reasoning": "one sentence"}`;

  return `You are a football analyst. Based on the following data, predict the exact score for this match.

Home team: ${homeTeam.name}, FIFA ranking: ${homeTeam.fifaRanking ?? "unknown"}, Group: ${homeTeam.group}
Key players: ${formatPlayers(homePlayers)}
Away team: ${awayTeam.name}, FIFA ranking: ${awayTeam.fifaRanking ?? "unknown"}, Group: ${awayTeam.group}
Key players: ${formatPlayers(awayPlayers)}
Stage: ${match.stage}, Venue: ${match.venue}, Date: ${match.date.toISOString()}${knockoutNote}

Respond ONLY in this exact JSON format, no other text:
${jsonShape}`;
}

// `includePlayers: false` produces a compact prompt (team names and
// rankings only) for models with small context/rate limits, e.g. Qwen 3
// on Groq's free tier (6k tokens-per-minute).
export function buildTournamentPrompt(
  teams: (Team & { players: Player[] })[],
  options: { includePlayers?: boolean } = {}
): string {
  const includePlayers = options.includePlayers ?? true;
  const teamLines = teams
    .map((t) =>
      includePlayers
        ? `- ${t.name} (FIFA ranking: ${t.fifaRanking ?? "unknown"}), key players: ${formatPlayers(t.players)}`
        : `- ${t.name} (FIFA ranking: ${t.fifaRanking ?? "unknown"})`
    )
    .join("\n");

  return `You are a football analyst. The FIFA World Cup 2026 is about to begin with 48 teams. Based on squad quality, historical performance, and current form, predict:
1. The team that will win the World Cup
2. The player who will win the Golden Boot (top scorer)
3. The goalkeeper who will win the Golden Glove (best goalkeeper)
4. The player who will win the Golden Ball (best player of the tournament)

Teams in the tournament:
${teamLines}

Respond ONLY in this exact JSON format, no other text:
{"winner": "country name", "goldenBoot": "player full name", "goldenGlove": "goalkeeper full name", "goldenBall": "player full name", "reasoning": "brief 2 sentence explanation"}`;
}

// ---------- Response parsing ----------

// Models sometimes wrap JSON in markdown fences or extra prose;
// extract the first {...} block before parsing. Reasoning models
// (DeepSeek R1, Qwen 3) may emit a <think>...</think> block that can
// itself contain braces, so drop it before searching for JSON.
function extractJson(text: string): Record<string, unknown> {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const jsonMatch = withoutThinking.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object found in response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

// Clamps a self-reported confidence to a whole 0–100, or null if the model
// omitted it or returned something unparseable.
function parseConfidence(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parsePrediction(text: string): MatchPrediction {
  const parsed = extractJson(text);
  if (
    typeof parsed.homeScore !== "number" ||
    typeof parsed.awayScore !== "number" ||
    typeof parsed.reasoning !== "string"
  ) {
    throw new Error(`Response JSON has wrong shape: ${text.slice(0, 200)}`);
  }
  const homeScore = Math.round(parsed.homeScore);
  const awayScore = Math.round(parsed.awayScore);
  // A shootout pick only matters when the model actually called a draw.
  const penaltyWinner =
    homeScore === awayScore &&
    typeof parsed.penaltyWinner === "string" &&
    parsed.penaltyWinner.trim()
      ? parsed.penaltyWinner.trim()
      : null;
  return {
    homeScore,
    awayScore,
    reasoning: parsed.reasoning,
    confidence: parseConfidence(parsed.confidence),
    penaltyWinner,
  };
}

function parseTournamentOutcome(text: string): TournamentOutcome {
  const parsed = extractJson(text);
  if (
    typeof parsed.winner !== "string" ||
    typeof parsed.goldenBoot !== "string" ||
    typeof parsed.goldenGlove !== "string" ||
    typeof parsed.goldenBall !== "string" ||
    typeof parsed.reasoning !== "string"
  ) {
    throw new Error(`Response JSON has wrong shape: ${text.slice(0, 200)}`);
  }
  return {
    winner: parsed.winner,
    goldenBoot: parsed.goldenBoot,
    goldenGlove: parsed.goldenGlove,
    goldenBall: parsed.goldenBall,
    reasoning: parsed.reasoning,
  };
}

function getKey(name: string): string {
  const key = process.env[name];
  if (!key) {
    throw new Error(`${name} is not set. Add it to your .env file.`);
  }
  return key;
}

/**
 * Calls `attempt` and parses the result; on malformed JSON or API error,
 * retries once. If the retry also fails, logs the error and returns null
 * so the caller can skip this AI for this match.
 */
async function withRetry<T>(
  aiModel: string,
  parse: (text: string) => T,
  attempt: () => Promise<string>
): Promise<T | null> {
  for (let i = 0; i < 2; i++) {
    try {
      return parse(await attempt());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (i === 0) {
        console.warn(`[${aiModel}] attempt 1 failed, retrying: ${message}`);
      } else {
        console.error(`[${aiModel}] attempt 2 failed, skipping: ${message}`);
      }
    }
  }
  return null;
}

// ---------- Per-model raw completion calls ----------

function geminiCompletion(prompt: string): () => Promise<string> {
  const genAI = new GoogleGenerativeAI(getKey("GEMINI_API_KEY"));
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  return async () => {
    const result = await model.generateContent(prompt);
    return result.response.text();
  };
}

function openAICompatibleCompletion(
  client: OpenAI,
  model: string,
  prompt: string
): () => Promise<string> {
  return async () => {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    // Some gateways (e.g. OpenRouter) return HTTP 200 with an error body
    // instead of choices; surface that body so withRetry can log it.
    if (!completion.choices?.length) {
      throw new Error(`No choices in response: ${JSON.stringify(completion)}`);
    }
    return completion.choices[0]?.message?.content ?? "";
  };
}

// Reasoning models (DeepSeek R1, Nemotron) can be slow on free gateways,
// so cap each request rather than letting the SDK's 10-minute default hang
// the whole run. withRetry already does its own retry pass on top of this.
const CLIENT_OPTS = { timeout: 120_000, maxRetries: 1 } as const;

function gptCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({ apiKey: getKey("OPENAI_API_KEY"), ...CLIENT_OPTS });
  return openAICompatibleCompletion(client, "gpt-5-mini", prompt);
}

// DeepSeek R1 served through OpenRouter (DEEPSEEK_API_KEY holds an
// OpenRouter key). This is a paid model: the account needs credits and
// the key must not have a $0 spending limit.
function deepSeekCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({
    apiKey: getKey("DEEPSEEK_API_KEY"),
    baseURL: "https://openrouter.ai/api/v1",
    ...CLIENT_OPTS,
  });
  return openAICompatibleCompletion(client, "deepseek/deepseek-r1", prompt);
}

function llamaCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({
    apiKey: getKey("GROQ_API_KEY"),
    baseURL: "https://api.groq.com/openai/v1",
    ...CLIENT_OPTS,
  });
  return openAICompatibleCompletion(
    client,
    "meta-llama/llama-4-scout-17b-16e-instruct",
    prompt
  );
}

// Nemotron Ultra runs on OpenRouter's free tier with its own key.
function nemotronCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({
    apiKey: getKey("NEMOTRON_ULTRA_API_KEY"),
    baseURL: "https://openrouter.ai/api/v1",
    ...CLIENT_OPTS,
  });
  return openAICompatibleCompletion(
    client,
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    prompt
  );
}

// Qwen 3 runs on Groq: OpenRouter's free Qwen models are rate-limited
// upstream and unreliable, while Groq hosts qwen3-32b on the free tier.
function qwenCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({
    apiKey: getKey("GROQ_API_KEY"),
    baseURL: "https://api.groq.com/openai/v1",
    ...CLIENT_OPTS,
  });
  return openAICompatibleCompletion(client, "qwen/qwen3-32b", prompt);
}

// ---------- Match score predictions ----------

export async function predictWithGemini(
  prompt: string
): Promise<MatchPrediction | null> {
  return withRetry("gemini", parsePrediction, geminiCompletion(prompt));
}

export async function predictWithGPT(
  prompt: string
): Promise<MatchPrediction | null> {
  return withRetry("gpt", parsePrediction, gptCompletion(prompt));
}

export async function predictWithDeepSeek(
  prompt: string
): Promise<MatchPrediction | null> {
  return withRetry("deepseek", parsePrediction, deepSeekCompletion(prompt));
}

export async function predictWithLlama(
  prompt: string
): Promise<MatchPrediction | null> {
  return withRetry("llama", parsePrediction, llamaCompletion(prompt));
}

export async function predictWithQwen(
  prompt: string
): Promise<MatchPrediction | null> {
  return withRetry("qwen", parsePrediction, qwenCompletion(prompt));
}

export async function predictWithNemotron(
  prompt: string
): Promise<MatchPrediction | null> {
  return withRetry("nemotron", parsePrediction, nemotronCompletion(prompt));
}

// ---------- Tournament outcome predictions ----------

export async function predictTournamentWithGemini(
  prompt: string
): Promise<TournamentOutcome | null> {
  return withRetry("gemini", parseTournamentOutcome, geminiCompletion(prompt));
}

export async function predictTournamentWithGPT(
  prompt: string
): Promise<TournamentOutcome | null> {
  return withRetry("gpt", parseTournamentOutcome, gptCompletion(prompt));
}

export async function predictTournamentWithDeepSeek(
  prompt: string
): Promise<TournamentOutcome | null> {
  return withRetry("deepseek", parseTournamentOutcome, deepSeekCompletion(prompt));
}

export async function predictTournamentWithLlama(
  prompt: string
): Promise<TournamentOutcome | null> {
  return withRetry("llama", parseTournamentOutcome, llamaCompletion(prompt));
}

export async function predictTournamentWithQwen(
  prompt: string
): Promise<TournamentOutcome | null> {
  return withRetry("qwen", parseTournamentOutcome, qwenCompletion(prompt));
}

export async function predictTournamentWithNemotron(
  prompt: string
): Promise<TournamentOutcome | null> {
  return withRetry("nemotron", parseTournamentOutcome, nemotronCompletion(prompt));
}

// ---------- Ensemble (consensus) ----------

// Re-exported from ai-meta (the canonical home) so existing
// `from "./predictor"` importers keep working.
export { CONSENSUS_MODEL_NAME } from "./ai-meta";

// Averages the individual models' scorelines into a single prediction,
// rounding each score to the nearest whole goal. Returns null when there
// are no predictions to combine.
export function buildConsensusPrediction(
  predictions: MatchPrediction[]
): MatchPrediction | null {
  if (predictions.length === 0) return null;
  const mean = (nums: number[]) =>
    Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);
  // Average only the models that reported a confidence; null if none did.
  const confidences = predictions
    .map((p) => p.confidence)
    .filter((c): c is number => c !== null);
  const homeScore = mean(predictions.map((p) => p.homeScore));
  const awayScore = mean(predictions.map((p) => p.awayScore));
  // If the averaged scoreline is a draw, the ensemble also needs a shootout
  // pick: the majority of whatever picks the individual models supplied.
  const penaltyPicks = predictions
    .map((p) => p.penaltyWinner)
    .filter((w): w is string => w != null);
  const penaltyWinner =
    homeScore === awayScore && penaltyPicks.length > 0
      ? majorityPick(penaltyPicks)
      : null;
  return {
    homeScore,
    awayScore,
    reasoning: `Consensus of ${predictions.length} model${
      predictions.length === 1 ? "" : "s"
    } — the average of their predicted scorelines.`,
    confidence: confidences.length > 0 ? mean(confidences) : null,
    penaltyWinner,
  };
}

// Picks the most-backed value among `values`, grouping spellings that
// normalize alike (so "Mbappé" and "Mbappe" count together). Ties break
// toward the earliest pick; within the winning group the most common raw
// spelling is returned for display.
function majorityPick(values: string[]): string {
  const groups = new Map<
    string,
    { count: number; firstIndex: number; spellings: Map<string, number> }
  >();
  values.forEach((value, index) => {
    const key = normalizeName(value);
    let group = groups.get(key);
    if (!group) {
      group = { count: 0, firstIndex: index, spellings: new Map() };
      groups.set(key, group);
    }
    group.count += 1;
    group.spellings.set(value, (group.spellings.get(value) ?? 0) + 1);
  });

  const winner = Array.from(groups.values()).sort(
    (a, b) => b.count - a.count || a.firstIndex - b.firstIndex
  )[0];
  return Array.from(winner.spellings.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0][0];
}

// The ensemble's tournament prediction: a per-prize majority vote across the
// individual models' picks. Returns null when there are no picks to combine.
export function buildTournamentConsensus(
  outcomes: TournamentOutcome[]
): TournamentOutcome | null {
  if (outcomes.length === 0) return null;
  return {
    winner: majorityPick(outcomes.map((o) => o.winner)),
    goldenBoot: majorityPick(outcomes.map((o) => o.goldenBoot)),
    goldenGlove: majorityPick(outcomes.map((o) => o.goldenGlove)),
    goldenBall: majorityPick(outcomes.map((o) => o.goldenBall)),
    reasoning: `Majority vote of ${outcomes.length} model${
      outcomes.length === 1 ? "" : "s"
    } — the most-backed pick for each prize.`,
  };
}

// ---------- Model registry ----------

// Canonical aiModel names stored in the database, paired with the
// prediction functions for each model. Scripts should iterate these
// instead of hardcoding their own lists.

export const MATCH_AI_MODELS: {
  name: string;
  predict: (prompt: string) => Promise<MatchPrediction | null>;
}[] = [
  { name: "GPT-5-mini", predict: predictWithGPT },
  { name: "Gemini Flash", predict: predictWithGemini },
  { name: "DeepSeek", predict: predictWithDeepSeek },
  { name: "Llama 4 Scout", predict: predictWithLlama },
  { name: "Qwen 3", predict: predictWithQwen },
  { name: "Nemotron Ultra", predict: predictWithNemotron },
];

export const TOURNAMENT_AI_MODELS: {
  name: string;
  predict: (prompt: string) => Promise<TournamentOutcome | null>;
  // Qwen 3 on Groq's free tier is limited to 6k tokens/minute, so it
  // gets the compact prompt (no player lists, ~1k tokens).
  compactPrompt?: boolean;
}[] = [
  { name: "GPT-5-mini", predict: predictTournamentWithGPT },
  { name: "Gemini Flash", predict: predictTournamentWithGemini },
  { name: "DeepSeek", predict: predictTournamentWithDeepSeek },
  { name: "Llama 4 Scout", predict: predictTournamentWithLlama },
  { name: "Qwen 3", predict: predictTournamentWithQwen, compactPrompt: true },
  { name: "Nemotron Ultra", predict: predictTournamentWithNemotron },
];
