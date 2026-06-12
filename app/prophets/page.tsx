// The Prophets: the full squad sheet. A stat band up top, then each AI
// as a Panini sticker beside its profile — role, blurb, league statline,
// and a collectible card with its tournament picks from the database.

import { existsSync } from "fs";
import path from "path";
import ProphetPickDeck from "@/components/ProphetPickDeck";
import ProphetSticker from "@/components/ProphetSticker";
import { AI_META, getAIMeta } from "@/lib/ai-meta";
import { prisma } from "@/lib/db";
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

// National tints for the predicted champion (same palettes as the
// homepage star cards); unknown countries keep the default sleeve.
const COUNTRY_THEMES: Record<string, { t1: string; t2: string }> = {
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

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function playerPhoto(name: string): string | null {
  const file = PLAYER_PHOTO_FILES[normalizeName(name)];
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
  // card tint) from the squad data, keyed by accent-stripped name.
  const pickedPlayerNames = picks.flatMap((p) => [
    p.predictedGoldenBoot,
    p.predictedGoldenGlove,
  ]);
  const pickedPlayers = await prisma.player.findMany({
    where: { name: { in: pickedPlayerNames } },
    include: { team: { select: { name: true, flagUrl: true } } },
  });
  const teamByPlayer = new Map(
    pickedPlayers.map((pl) => [normalizeName(pl.name), pl.team])
  );

  function playerCard(label: string, points: number, name: string) {
    const team = teamByPlayer.get(normalizeName(name));
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

  const band: [string | number, string][] = [
    [AI_META.length, "Oracles"],
    [matchesCalled, "Matches Called"],
    [totalExact, "Exact Scores"],
    [anyScored && leader ? getAIMeta(leader.aiModel).short : "—", "Current Leader"],
  ];

  return (
    <div className="wrap page">
      <header className="page-head">
        <div className="page-eyebrows reveal">
          <span className="eyebrow">The Squad Sheet</span>
          <span className="label-mono">{"// SIX MACHINE MINDS"}</span>
        </div>
        <h1 className="page-title reveal">
          The <em>Prophets</em>
        </h1>
        <p className="page-intro reveal">
          Six frontier models, each with its own temperament. They read the
          same data and reach for the same trophy — but no two call a match
          the same way. <b>Meet the oracles.</b>
        </p>
      </header>

      <div className="prophet-band reveal">
        {band.map(([num, label]) => (
          <div className="pb-cell" key={label}>
            <span className="pb-cell__num">{num}</span>
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
