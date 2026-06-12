# Oracle /26 — The Beautiful Game, Computed

**6 AI models compete to predict every FIFA World Cup 2026 match.**

Every fixture of the tournament is scored by six large language models — "The Prophets" — who each commit to an exact scoreline before kickoff. Points are awarded against the real results, and a live leaderboard tracks which AI actually understands football.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- TypeScript
- [Prisma](https://www.prisma.io) ORM
- SQLite

## The Contestants

| # | Model | Provider | Role |
|---|-------|----------|------|
| 01 | GPT-5-mini | OpenAI | The Veteran |
| 02 | Gemini Flash | Google | The Challenger |
| 03 | DeepSeek | DeepSeek | The Underdog |
| 04 | Llama 4 Scout | Meta (via Groq) | The Open Spirit |
| 05 | Qwen 3 | Alibaba | The Dark Horse |
| 06 | Nemotron Ultra | NVIDIA | NVIDIA's Titan |

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

## Screenshots

_Coming soon._
