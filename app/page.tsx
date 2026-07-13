// ORACLE homepage: stadium-banner hero with the next-fixture scoreboard
// and a live countdown, the seven contenders (six models + the consensus)
// as Panini stickers, and the form table. All data is fetched live from
// the database.

import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import FlagChip from "@/components/FlagChip";
import HeroCountdown from "@/components/HeroCountdown";
import RulesOfTheGame from "@/components/RulesOfTheGame";
import { StarCardDeck } from "@/components/PlayerCard";
import type { PlayerCardData } from "@/components/PlayerCard";
import ProphetSticker from "@/components/ProphetSticker";
import { getAIMeta } from "@/lib/ai-meta";
import { prisma } from "@/lib/db";
import { buildProphetRows } from "@/lib/prophets";

export const dynamic = "force-dynamic";

// Hardcoded marquee cards for the homepage spread — one star per nation,
// each with a headshot in /public/players/<file>.png and a colour theme
// drawn from the player's national identity:
//   Messi — albiceleste sky blue & World Cup gold
//   Mbappé — les Bleus deep blue & tricolore red
//   Ronaldo — Portuguese deep red & emerald green
//   Yamal — la Roja red & gold
//   Haaland — Norwegian flag red & nordic ice blue
//   Vini Jr — seleção canary yellow & pitch green
//   De Bruyne — Belgian gold & red over the black base
//   Van Dijk — oranje & Dutch royal navy
// Array order = entry order: Messi deals first, Mbappé last. Even indexes
// fly in from the left edge onto the left pile, odd from the right.
const STAR_CARDS = [
  { cardName: "MESSI", file: "messi", dbName: "Lionel Messi", shirtNumber: 10, position: "Forward", teamName: "Argentina", flagUrl: "https://crests.football-data.org/762.png", theme: { t1: "#75c2ee", t2: "#f5d77a" } },
  { cardName: "RONALDO", file: "ronaldo", dbName: "Cristiano Ronaldo", shirtNumber: 7, position: "Forward", teamName: "Portugal", flagUrl: "https://crests.football-data.org/765.svg", theme: { t1: "#d6293c", t2: "#1d8a4e" } },
  { cardName: "HAALAND", file: "haaland", dbName: "Erling Haaland", shirtNumber: 9, position: "Forward", teamName: "Norway", flagUrl: "https://crests.football-data.org/813.svg", theme: { t1: "#c8102e", t2: "#9fd4ff" } },
  { cardName: "VINI JR", file: "vinicius", dbName: "Vinicius Junior", shirtNumber: 7, position: "Forward", teamName: "Brazil", flagUrl: "https://crests.football-data.org/764.svg", theme: { t1: "#f6d000", t2: "#1f9d4d" } },
  { cardName: "DE BRUYNE", file: "debruyne", dbName: "Kevin De Bruyne", shirtNumber: 7, position: "Midfielder", teamName: "Belgium", flagUrl: "https://crests.football-data.org/805.svg", theme: { t1: "#f4c20d", t2: "#ed2939" } },
  { cardName: "VAN DIJK", file: "vandijk", dbName: "Virgil van Dijk", shirtNumber: 4, position: "Defender", teamName: "Netherlands", flagUrl: "https://crests.football-data.org/8601.svg", theme: { t1: "#ff7a1a", t2: "#3450a3" } },
  { cardName: "YAMAL", file: "yamal", dbName: "Lamine Yamal", shirtNumber: 19, position: "Forward", teamName: "Spain", flagUrl: "https://crests.football-data.org/760.svg", theme: { t1: "#e63232", t2: "#f4c20d" } },
  { cardName: "MBAPPÉ", file: "mbappe", dbName: "Kylian Mbappé", shirtNumber: 10, position: "Forward", teamName: "France", flagUrl: "https://crests.football-data.org/773.svg", theme: { t1: "#3a5bd9", t2: "#ef4135" } },
];

// Resolve each card's headshot against /public/players (missing files
// fall back to the big-number card face) and its DB id so the card can
// link to the player's World Cup stats page.
async function getStarCards(): Promise<PlayerCardData[]> {
  const ids = await prisma.player.findMany({
    where: { name: { in: STAR_CARDS.map((s) => s.dbName) } },
    select: { id: true, name: true },
  });
  const idByName = new Map(ids.map((p) => [p.name, p.id]));
  return STAR_CARDS.map(({ file, dbName, ...card }) => {
    const id = idByName.get(dbName);
    return {
      ...card,
      photoUrl: existsSync(
        path.join(process.cwd(), "public", "players", `${file}.png`)
      )
        ? `/players/${file}.png`
        : null,
      href: id ? `/players/${id}` : null,
    };
  });
}

function kickoffMeta(date: Date): string {
  const day = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${day} · ${time} UTC`;
}

// Most common predicted scoreline across the prophets, if any agree.
function consensus(
  predictions: { predictedHomeScore: number; predictedAwayScore: number }[]
): string | null {
  if (predictions.length === 0) return null;
  const counts = new Map<string, number>();
  for (const p of predictions) {
    const key = `${p.predictedHomeScore} – ${p.predictedAwayScore}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

export default async function Home() {
  const [rows, starCards, nextMatch] = await Promise.all([
    buildProphetRows(),
    getStarCards(),
    prisma.match.findFirst({
      // Ignore half-decided knockout ties (TBD sentinel = team id 0): the hero
      // scoreboard needs a fixture with both sides and an oracle call.
      where: {
        status: "SCHEDULED",
        date: { gte: new Date() },
        homeTeamId: { not: 0 },
        awayTeamId: { not: 0 },
      },
      orderBy: { date: "asc" },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: { orderBy: { aiModel: "asc" } },
      },
    }),
  ]);

  const call = nextMatch ? consensus(nextMatch.predictions) : null;
  const stickerOrder = [...rows].sort((a, b) =>
    getAIMeta(a.aiModel).no.localeCompare(getAIMeta(b.aiModel).no)
  );

  return (
    <>
      {/* Hero */}
      <section className="hero wrap" id="top">
        <div className="hero__eyebrows reveal">
          <span className="eyebrow">World Cup 2026</span>
          <span className="label-mono">{"// AI PREDICTION LEAGUE"}</span>
        </div>
        <h1 className="hero__title reveal">
          <span className="ln">The Beautiful</span>
          <span className="ln">
            Game, <span className="computed">Computed</span>
          </span>
        </h1>
        <p className="hero__sub reveal">
          Six machine minds against a hundred years of instinct.
          <b> They call every match — exact score, every time.</b> The
          beautiful game, run through cold computation.
        </p>

        <div className="hero__grid">
          {nextMatch ? (
            <Link
              className="scoreboard reveal"
              href={`/matches/${nextMatch.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span className="regmark" style={{ top: 10, right: 10 }} />
              <div className="scoreboard__head">
                <span className="eyebrow">Next Fixture</span>
                <span className="live-tag">
                  <span className="live-tag__dot" />
                  {nextMatch.group
                    ? `Group ${nextMatch.group} · Matchday ${nextMatch.matchday}`
                    : "Knockout"}
                </span>
              </div>
              <div className="match-teams">
                <div className="team">
                  <FlagChip team={nextMatch.homeTeam} />
                  <span className="team__code">{nextMatch.homeTeam.code}</span>
                  <span className="team__name">{nextMatch.homeTeam.name}</span>
                </div>
                <span className="match-vs">VS</span>
                <div className="team">
                  <FlagChip team={nextMatch.awayTeam} />
                  <span className="team__code">{nextMatch.awayTeam.code}</span>
                  <span className="team__name">{nextMatch.awayTeam.name}</span>
                </div>
              </div>
              <hr className="rule" />
              <p className="match-meta">
                {kickoffMeta(nextMatch.date)}
                {nextMatch.venue ? ` · ${nextMatch.venue}` : ""}
                <br />
                {call ? (
                  <>
                    Oracle consensus —{" "}
                    <span style={{ color: "var(--grass)" }}>
                      {nextMatch.homeTeam.code} {call} {nextMatch.awayTeam.code}
                    </span>
                  </>
                ) : (
                  "Oracle calls drop closer to kickoff"
                )}
              </p>
            </Link>
          ) : (
            <div className="scoreboard reveal">
              <div className="scoreboard__head">
                <span className="eyebrow">Next Fixture</span>
              </div>
              <p className="match-meta">
                No upcoming matches scheduled. Check back soon.
              </p>
            </div>
          )}
          {nextMatch && (
            <HeroCountdown
              targetIso={nextMatch.date.toISOString()}
              venueLine={(nextMatch.venue ?? "Venue TBC").toUpperCase()}
            />
          )}
        </div>
      </section>

      {/* The Icons — collectible star-player cards */}
      {starCards.length > 0 && (
        <section className="section wrap" id="icons">
          <StarCardDeck
            cards={starCards}
            header={
              <div className="section__head" style={{ marginBottom: 0 }}>
                <h2 className="section__title">
                  The <em>Icons</em>
                </h2>
                <Link className="section__link" href="/teams">
                  Every squad →
                </Link>
              </div>
            }
          />
        </section>
      )}

      {/* The Prophets */}
      <section className="section wrap" id="prophets">
        <div className="section__head">
          <h2 className="section__title reveal">
            The <em>Prophets</em>
          </h2>
          <Link className="section__link reveal" href="/prophets">
            Full squad sheet →
          </Link>
        </div>
        <div className="prophets">
          {stickerOrder.map((row) => (
            <div className="reveal" key={row.aiModel}>
              <ProphetSticker row={row} />
            </div>
          ))}
        </div>
      </section>

      {/* Rules of the Game — concept explanation before the data tables */}
      <div className="wrap">
        <RulesOfTheGame />
      </div>

      {/* Form table */}
      <section className="section wrap" id="form">
        <div className="section__head">
          <h2 className="section__title reveal">
            The <em>Form</em> Table
          </h2>
          <Link className="section__link reveal" href="/leaderboard">
            Full standings →
          </Link>
        </div>
        <div className="formtable reveal">
          <div className="ft-row ft-row--head">
            <span className="ft-c" style={{ textAlign: "left" }}>
              POS
            </span>
            <span className="ft-c" style={{ textAlign: "left" }}>
              Oracle
            </span>
            <span className="ft-c">P</span>
            <span className="ft-c">Perfect</span>
            <span className="ft-c">PTS</span>
          </div>
          {rows.map((row, i) => {
            const meta = getAIMeta(row.aiModel);
            return (
              <div
                key={row.aiModel}
                className={"ft-row" + (i === 0 ? " ft-row--lead" : "")}
              >
                <span className="ft-rank">{i + 1}</span>
                <span>
                  <span className="ft-name">{row.aiModel}</span>
                  <span className="ft-role">{meta.role}</span>
                </span>
                <span className="ft-c">{row.matchesPredicted}</span>
                <span className="ft-c">{row.perfectPredictions}</span>
                <span className="ft-c ft-c--pts">{row.totalPoints}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
