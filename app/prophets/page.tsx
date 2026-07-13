// The Prophets: the full squad sheet. A stat band up top, then each AI
// as a Panini sticker beside its profile — role, blurb, league statline,
// and a collectible card with its tournament picks from the database.

import { existsSync } from "fs";
import path from "path";
import ProphetPickDeck from "@/components/ProphetPickDeck";
import CountUp from "@/components/CountUp";
import ProphetSticker from "@/components/ProphetSticker";
import { AI_META, CONTESTANT_COUNT, getAIMeta } from "@/lib/ai-meta";
import { COUNTRY_THEMES } from "@/lib/country-themes";
import { prisma } from "@/lib/db";
import { buildPlayerResolutionMap } from "@/lib/player-name-match";
import { avg, buildProphetRows, pct } from "@/lib/prophets";
import { TOURNAMENT_POINTS } from "@/lib/scoring";

// Headshot files in /public/players, keyed by accent-stripped lowercase
// name as the AIs write it. Goalkeeper files can be added later — until
// then the card shows an initials disc for them.
const PLAYER_PHOTO_FILES: Record<string, string> = {
  "lionel messi": "messi",
  "cristiano ronaldo": "ronaldo",
  "erling haaland": "haaland",
  "kylian mbappe": "mbappe",
  "vinicius junior": "vinicius",
  "kevin de bruyne": "debruyne",
  "virgil van dijk": "vandijk",
  "lamine yamal": "yamal",
  "ousmane dembele": "dembele",
  neymar: "neymar",
  pedri: "pedri",
  "alisson becker": "alisson",
  "mike maignan": "maignan",
  "thibaut courtois": "courtois",
};

// Used only for the PLAYER_PHOTO_FILES lookup. Strips accents and
// punctuation, expands common suffix abbreviations so "Vinícius Jr."
// hits the same key as "Vinicius Junior".
const PHOTO_ABBREV: Record<string, string> = { jr: "junior", sr: "senior" };

function photoNormalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => PHOTO_ABBREV[t] ?? t)
    .join(" ");
}

function playerPhoto(name: string): string | null {
  const file = PLAYER_PHOTO_FILES[photoNormalizeName(name)];
  if (!file) return null;
  return existsSync(path.join(process.cwd(), "public", "players", `${file}.png`))
    ? `/players/${file}.png`
    : null;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Prophets — ORACLE /26",
};

export default async function ProphetsPage() {
  const [rows, picks, matchesCalled, teams] = await Promise.all([
    buildProphetRows(),
    // Do NOT add `where: { id: { gte: 0 } }` — it reads stale on Turso's HTTP
    // libSQL adapter; bare findMany reads current data.
    prisma.tournamentPrediction.findMany(),
    prisma.prediction
      .groupBy({ by: ["matchId"] })
      .then((groups) => groups.length),
    prisma.team.findMany({ select: { name: true, flagUrl: true } }),
  ]);

  const rowByName = new Map(rows.map((r) => [r.aiModel, r]));
  const pickByName = new Map(picks.map((p) => [p.aiModel, p]));
  const flagByTeam = new Map(teams.map((t) => [t.name, t.flagUrl]));

  // Resolve each picked player's nation (for the corner flag and the
  // card tint) using fuzzy name matching. AI predictions may spell names
  // with variant accents or abbreviations (e.g. "Vinícius Jr." vs the DB's
  // "Vinicius Junior"), so we fetch all players and match with token-level
  // normalisation rather than a strict Prisma `name: { in: [...] }`.
  const pickedPlayerNames = picks.flatMap((p) =>
    [p.predictedGoldenBoot, p.predictedGoldenGlove, p.predictedGoldenBall].filter(
      (n): n is string => Boolean(n)
    )
  );
  const allPlayers = await prisma.player.findMany({
    select: { name: true, team: { select: { name: true, flagUrl: true } } },
  });
  const playerResolutionMap = buildPlayerResolutionMap(pickedPlayerNames, allPlayers);
  const teamByPlayer = new Map(
    Array.from(playerResolutionMap.entries()).map(([pickName, pl]) => [pickName, pl.team])
  );

  function playerCard(label: string, points: number, name: string) {
    const team = teamByPlayer.get(name);
    return {
      label,
      points,
      name,
      imageUrl: playerPhoto(name),
      flagUrl: team?.flagUrl ?? null,
      theme: team ? COUNTRY_THEMES[team.name] ?? null : null,
    };
  }
  const leader = rows[0];
  const anyScored = rows.some((r) => r.matchesPredicted > 0);
  const totalExact = rows.reduce((s, r) => s + r.perfectPredictions, 0);

  // 7 contenders: the six independent models plus the Oracle Consensus.
  const band: { num: string | number; label: string; title?: string }[] = [
    { num: CONTESTANT_COUNT, label: "Contenders" },
    { num: matchesCalled, label: "Matches Called" },
    { num: totalExact, label: "Exact Scores" },
    {
      num: anyScored && leader ? getAIMeta(leader.aiModel).short : "—",
      label: "Current Leader",
      title: anyScored && leader ? leader.aiModel : undefined,
    },
  ];

  return (
    <div className="wrap page">
      <header className="page-head">
        <div className="page-eyebrows reveal">
          <span className="eyebrow">The Squad Sheet</span>
          <span className="label-mono">{"// SIX MACHINE MINDS + ONE HIVE"}</span>
        </div>
        <h1 className="page-title reveal">
          The <em>Prophets</em>
        </h1>
        <p className="page-intro reveal">
          Six frontier models, each with its own temperament — plus the Oracle
          Consensus, the average of them all. They read the same data and reach
          for the same trophy, but no two call a match the same way.{" "}
          <b>Meet the oracles.</b>
        </p>
      </header>

      <div className="prophet-band reveal">
        {band.map(({ num, label, title }) => (
          <div className="pb-cell" key={label}>
            {typeof num === "number" ? (
              <CountUp className="pb-cell__num" value={num} />
            ) : (
              <span
                className="pb-cell__num"
                title={title}
                aria-label={title ? `${label}: ${title}` : undefined}
              >
                {num}
              </span>
            )}
            <span className="pb-cell__lab">{label}</span>
          </div>
        ))}
      </div>

      <section>
        {AI_META.map((meta, i) => {
          const row = rowByName.get(meta.name) ?? {
            aiModel: meta.name,
            totalPoints: 0,
            matchesPredicted: 0,
            perfectPredictions: 0,
            winnerCorrect: 0,
            results: [],
            form: [] as ("w" | "d" | "l")[],
          };
          const pick = pickByName.get(meta.name);
          return (
            <div className="prophet-row reveal" key={meta.no}>
              <div className="prophet-row__sticker">
                <ProphetSticker row={row} />
              </div>
              <div className="prophet-detail">
                <p className="prophet-detail__role">
                  No. {meta.no} · {meta.role}
                </p>
                <h2 className="prophet-detail__name">{meta.name}</h2>
                <p className="prophet-detail__model">
                  {meta.org} · joined the league ’26
                </p>
                <p className="prophet-detail__blurb">{meta.blurb}</p>
                <div className="prophet-statline">
                  <div className="psl">
                    <span className="psl__num grass">{row.totalPoints}</span>
                    <span className="psl__lab">Points</span>
                  </div>
                  <div className="psl">
                    <span className="psl__num">
                      {pct(row.winnerCorrect, row.matchesPredicted)}
                    </span>
                    <span className="psl__lab">Winner Hit</span>
                  </div>
                  <div className="psl">
                    <span className="psl__num">{row.perfectPredictions}</span>
                    <span className="psl__lab">Exact Scores</span>
                  </div>
                  <div className="psl">
                    <span className="psl__num">{row.matchesPredicted}</span>
                    <span className="psl__lab">Matches Scored</span>
                  </div>
                  <div className="psl">
                    <span className="psl__num">
                      {avg(row.totalPoints, row.matchesPredicted)}
                    </span>
                    <span className="psl__lab">Avg / Match</span>
                  </div>
                </div>
              </div>
              {pick && (
                <div className="prophet-row__deck">
                  <ProphetPickDeck
                    side={i % 2 === 0 ? "right" : "left"}
                    cards={[
                      {
                        label: "Winner",
                        points: TOURNAMENT_POINTS.winner,
                        name: pick.predictedWinner,
                        imageUrl: flagByTeam.get(pick.predictedWinner) ?? null,
                        flagUrl: null,
                        theme: COUNTRY_THEMES[pick.predictedWinner] ?? null,
                      },
                      playerCard(
                        "Golden Glove",
                        TOURNAMENT_POINTS.goldenGlove,
                        pick.predictedGoldenGlove
                      ),
                      playerCard(
                        "Golden Boot",
                        TOURNAMENT_POINTS.goldenBoot,
                        pick.predictedGoldenBoot
                      ),
                      playerCard(
                        "Golden Ball",
                        TOURNAMENT_POINTS.goldenBall,
                        pick.predictedGoldenBall ?? "TBD"
                      ),
                    ]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
