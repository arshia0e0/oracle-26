# ORACLE /26 — The Beautiful Game, Computed

**Six AI models predict every FIFA World Cup 2026 match. One derived consensus tests whether the crowd can beat its smartest member. Seven rows on one table.**

Every fixture of the tournament is called by six large language models — "The Prophets" — who each commit to an exact scoreline before kickoff. Points are awarded against the real results, and a live leaderboard tracks which AI actually understands football. A seventh entry, the **Oracle Consensus**, is not a model: it is the average of the six calls, entered as its own contestant.

> Six models. One consensus. One table.

## Screenshots

_TODO: add screenshots of the homepage hero, The Prophets stickers, the Form Table and The Lab._

## Product Concept

- **Six independent models** each receive an identical prompt per match (teams, group, key players, stage, venue, kickoff) and must answer with an exact scoreline, a 0–100 confidence, and a one-sentence reasoning.
- **Oracle Consensus** is a derived aggregate — the per-match average of the six scorelines (rounded to whole goals), with majority votes for shootout and tournament picks. It never queries an LLM itself.
- **Seven leaderboard entries** compete on the same scoring rules, answering two questions at once: which model reads football best, and does the crowd beat the best individual?

The full user-facing explanation lives on the site's [/methodology](app/methodology/page.tsx) page.

## The Contestants

| # | Contestant | Provider | Underlying model | Role |
|---|-----------|----------|------------------|------|
| 01 | GPT-5-mini | OpenAI | `gpt-5-mini` (OpenAI API) | The Veteran |
| 02 | Gemini Flash | Google | `gemini-2.5-flash` (Google AI API) | The Challenger |
| 03 | DeepSeek | DeepSeek | `deepseek/deepseek-r1` (OpenRouter) | The Underdog |
| 04 | Llama 4 Scout | Meta | `meta-llama/llama-4-scout-17b-16e-instruct` (Groq) | The Open Spirit |
| 05 | Qwen 3 | Alibaba | `qwen/qwen3-32b` (Groq) | The Dark Horse |
| 06 | Nemotron Ultra | NVIDIA | `nvidia/nemotron-3-ultra-550b-a55b:free` (OpenRouter) | NVIDIA's Titan |
| 07 | Oracle Consensus | The Collective | *derived — average of rows 01–06* | The Hive Mind |

The canonical roster lives in [`lib/ai-meta.ts`](lib/ai-meta.ts) (display metadata, counts, taglines) and [`lib/predictor.ts`](lib/predictor.ts) (model registry + API clients).

## Technology Stack

- [Next.js 14](https://nextjs.org) (App Router, server components, `force-dynamic` data pages)
- TypeScript
- [Prisma 7](https://www.prisma.io) with driver adapters
- SQLite via better-sqlite3 (local) / [Turso](https://turso.tech) libSQL (production)
- [Framer Motion](https://www.framer.com/motion/) for the stat roll-ups
- Tailwind config present, but styling is hand-written CSS in `app/globals.css`
- Deployed on Vercel; a cron hits `/api/cron` for the daily update

## Architecture & Data Flow

```
football-data.org (fixtures, results, squads)
        │  lib/sync.ts (upserts)
        ▼
   SQLite / Turso  ◄────────────────────────────┐
        │                                       │
        │  lib/daily-update.ts                  │ lib/scoring.ts
        │  1. sync results                      │ (writes LeaderboardEntry
        │  2. score finished matches ───────────┘  per model per match)
        │  3. predict upcoming (≤48h) matches
        ▼
 lib/predictor.ts — one identical prompt → six models (JSON answers)
        │
        ▼
 lib/consensus.ts — average of the six calls → "Oracle Consensus" row
        │
        ▼
 Next.js server components (homepage, Prophets, Form Table, The Lab)
```

- **Prediction locking:** predictions are create-only with a unique `(aiModel, matchId)` constraint and a `createdAt` timestamp; only future `SCHEDULED` matches are ever sent to the models, so calls cannot be made or edited after kickoff. Failed models are retried on later runs, pre-kickoff only.
- **Consensus logic** (`lib/predictor.ts` → `buildConsensusPrediction` / `buildTournamentConsensus`): mean scoreline rounded to whole goals; mean confidence; majority vote for shootout picks when the average lands level, and per-prize majority vote for tournament picks (accent-insensitive name grouping, ties toward the earliest pick).

## Scoring Logic

Match points stack, up to **10** per match (`lib/scoring.ts` — `MATCH_POINTS`):

| Outcome | Points |
|---------|--------|
| Correct winner (or correct draw) | 3 |
| Correct goal difference | +2 |
| Correct exact score (bonus) | +5 |

Shootouts: goal difference and exact score are judged on the end-of-play scoreline (penalties excluded); the winner point goes to whoever called the side that *advanced*, using the model's own shootout pick when it predicted a draw.

Tournament-long predictions are scored once, when the World Cup ends (`TOURNAMENT_POINTS`):

| Prediction | Points |
|------------|--------|
| World Cup winner | 100 |
| Golden Boot | 150 |
| Golden Glove | 150 |
| Golden Ball | 150 |

## Local Setup

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local development uses a SQLite file (`dev.db`) — no extra setup needed.

To run the prediction pipeline you'll need API keys in `.env`: `FOOTBALL_DATA_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` (OpenRouter key), `GROQ_API_KEY`, `NEMOTRON_ULTRA_API_KEY` (OpenRouter key). Useful scripts:

```bash
npm run sync-data       # pull teams, squads and matches from football-data.org
npm run daily-update    # sync + score + predict (what the cron runs)
npm run refresh         # interactive refresh helper
npm run predict-match   # one match:  -- --matchId=12345
npm run score-match     # score one finished match
```

## Deployment

In production the app talks to [Turso](https://turso.tech) over libSQL. Setting `TURSO_DATABASE_URL` is what flips the switch; without it the app stays on local SQLite.

```bash
# one-time: create the database and grab credentials
turso db create worldcup-ai
turso db show worldcup-ai --url        # -> TURSO_DATABASE_URL
turso db tokens create worldcup-ai     # -> TURSO_AUTH_TOKEN

# push the local schema + data to Turso (safe to re-run, full overwrite)
npm run setup-turso
```

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your hosting provider's environment variables and deploy (the project deploys on Vercel; `vercel.json` pins the serverless region so functions read a fresh Turso replica).

## Major Technical Decisions

- **One schema, two SQLite dialects** — Prisma driver adapters run better-sqlite3 locally and libSQL/Turso in production, so dev and prod share one schema.
- **Flat reads, joined in memory** — leaderboard queries avoid wide relational `include`s and never use `where: { id: { gte: 0 } }`; both proved unreliable (stale/partial reads) on Turso's HTTP libSQL adapter.
- **Consensus as a regular row** — storing the derived consensus as an ordinary `Prediction`/`TournamentPrediction` row means scoring and every page treat it like any contestant, with zero special-casing downstream.
- **Score before predict** in the daily update, so finished matches bank points even if the slower prediction step fails partway.
- **Server-rendered stats** — animated counters render their final value in the initial HTML (`components/CountUp.tsx`), so crawlers, no-JS visitors, screen readers and reduced-motion users always see real numbers.

## AI-Assisted Development

ORACLE /26 was designed and built with AI-assisted development using Claude Fable 5 through Claude Code. Product direction, system design, data decisions, testing and final implementation decisions were directed and reviewed by the creator.

## Known Limitations

- The models' training data may include pre-tournament knowledge — this measures applied judgement, not clairvoyance.
- Free-tier gateways fail occasionally, so a match can be missing a model's call; the consensus then averages fewer voices.
- Confidence is self-reported by each model, not a market probability.
- `Team.fifaRanking` is not supplied by football-data.org and is currently unpopulated — prompts say "unknown". _TODO: backfill from an official source._
- Golden Boot / Glove / Ball outcomes are not auto-verified; only the champion is checked automatically.
- Squad data is a snapshot: no injuries, suspensions or confirmed lineups.

## Future Improvements

- Backfill FIFA rankings into the prompts.
- Auto-verify Golden Boot / Glove / Ball from tournament stats.
- Add real screenshots to this README.
- Per-stage breakdowns (group vs. knockout accuracy) in The Lab.
