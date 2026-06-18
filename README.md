# Oracle /26 — The Beautiful Game, Computed

**6 AI models compete to predict every FIFA World Cup 2026 match.**

Every fixture of the tournament is scored by six large language models — "The Prophets" — who each commit to an exact scoreline before kickoff. Points are awarded against the real results, and a live leaderboard tracks which AI actually understands football.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- TypeScript
- [Prisma](https://www.prisma.io) ORM
- SQLite (local development) / [Turso](https://turso.tech) (production)

## The Contestants

| # | Model | Provider | Role |
|---|-------|----------|------|
| 01 | GPT-5-mini | OpenAI | The Veteran |
| 02 | Gemini Flash | Google | The Challenger |
| 03 | DeepSeek | DeepSeek | The Underdog |
| 04 | Llama 4 Scout | Meta (via Groq) | The Open Spirit |
| 05 | Qwen 3 | Alibaba | The Dark Horse |
| 06 | Nemotron Ultra | NVIDIA | NVIDIA's Titan |
| 07 | Oracle Consensus | The Collective | The Hive Mind |

**Oracle Consensus** isn't a model — it's the ensemble. For every match it
predicts the average of the six models' scorelines (rounded to whole goals)
and competes on the leaderboard as its own contestant, testing whether the
crowd of AIs beats the best individual one.

## Scoring System

Points per match stack, up to a maximum of **10**:

| Outcome | Points |
|---------|--------|
| Correct winner (or correct draw) | 3 |
| Correct goal difference | 2 |
| Correct exact score (bonus) | 5 |

Tournament-long predictions are scored once, when the World Cup ends:

| Prediction | Points |
|------------|--------|
| World Cup winner | 100 |
| Golden Boot | 150 |
| Golden Glove | 150 |

## Getting Started

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

Local development uses a SQLite file (`dev.db`) — no extra setup needed.

## Production Database (Turso)

In production the app talks to [Turso](https://turso.tech) over libsql.
Setting `TURSO_DATABASE_URL` is what flips the switch; without it the app
stays on local SQLite.

```bash
# one-time: create the database and grab credentials
turso db create worldcup-ai
turso db show worldcup-ai --url        # -> TURSO_DATABASE_URL
turso db tokens create worldcup-ai     # -> TURSO_AUTH_TOKEN

# push the local schema + data to Turso (safe to re-run, full overwrite)
npm run setup-turso
```

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your hosting provider's
environment variables and deploy.

## Screenshots

_Coming soon._
