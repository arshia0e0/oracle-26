// Builds match-prediction prompts and queries five AI models
// (Gemini, GPT, DeepSeek R1, Llama, Qwen) for exact-score predictions.
//
// Requires in .env: GEMINI_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY
// (official DeepSeek platform key), GROQ_API_KEY (serves Llama and Qwen)

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { Match, Player, Team } from "./generated/prisma/client";

export interface MatchPrediction {
  homeScore: number;
  awayScore: number;
  reasoning: string;
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
  return `You are a football analyst. Based on the following data, predict the exact score for this match.

Home team: ${homeTeam.name}, FIFA ranking: ${homeTeam.fifaRanking ?? "unknown"}, Group: ${homeTeam.group}
Key players: ${formatPlayers(homePlayers)}
Away team: ${awayTeam.name}, FIFA ranking: ${awayTeam.fifaRanking ?? "unknown"}, Group: ${awayTeam.group}
Key players: ${formatPlayers(awayPlayers)}
Stage: ${match.stage}, Venue: ${match.venue}, Date: ${match.date.toISOString()}

Respond ONLY in this exact JSON format, no other text:
{"homeScore": number, "awayScore": number, "reasoning": "one sentence"}`;
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

function parsePrediction(text: string): MatchPrediction {
  const parsed = extractJson(text);
  if (
    typeof parsed.homeScore !== "number" ||
    typeof parsed.awayScore !== "number" ||
    typeof parsed.reasoning !== "string"
  ) {
    throw new Error(`Response JSON has wrong shape: ${text.slice(0, 200)}`);
  }
  return {
    homeScore: Math.round(parsed.homeScore),
    awayScore: Math.round(parsed.awayScore),
    reasoning: parsed.reasoning,
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

function gptCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({ apiKey: getKey("OPENAI_API_KEY") });
  return openAICompatibleCompletion(client, "gpt-5-mini", prompt);
}

// DeepSeek R1 served through OpenRouter (DEEPSEEK_API_KEY holds an
// OpenRouter key). This is a paid model: the account needs credits and
// the key must not have a $0 spending limit.
function deepSeekCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({
    apiKey: getKey("DEEPSEEK_API_KEY"),
    baseURL: "https://openrouter.ai/api/v1",
  });
  return openAICompatibleCompletion(client, "deepseek/deepseek-r1", prompt);
}

function llamaCompletion(prompt: string): () => Promise<string> {
  const client = new OpenAI({
    apiKey: getKey("GROQ_API_KEY"),
    baseURL: "https://api.groq.com/openai/v1",
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
