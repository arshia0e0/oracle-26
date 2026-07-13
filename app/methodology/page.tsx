// Methodology — how ORACLE /26 actually works: the contestants, the data
// they see, when predictions are collected and locked, how the consensus is
// derived, the scoring maths, and the project's honest limitations. Static
// server markup; the roster and point values come from the same modules the
// league itself runs on, so this page can't drift from the code.

import Link from "next/link";
import {
  AI_META,
  CONSENSUS_MODEL_NAME,
  CONTESTANT_COUNT,
  MODEL_COUNT,
} from "@/lib/ai-meta";
import {
  MATCH_POINTS,
  MATCH_POINTS_MAX,
  TOURNAMENT_POINTS,
} from "@/lib/scoring";

export const metadata = {
  title: "Methodology — ORACLE /26",
  description:
    "How ORACLE /26 works: six AI models predict every World Cup 2026 match, the Oracle Consensus averages their calls, and a fixed scoring system ranks them all.",
};

// The underlying model each contestant runs on and the gateway it is called
// through (see lib/predictor.ts — this table mirrors those clients).
const MODEL_TECH: Record<string, { model: string; via: string }> = {
  "GPT-5-mini": { model: "gpt-5-mini", via: "OpenAI API" },
  "Gemini Flash": { model: "gemini-2.5-flash", via: "Google AI API" },
  DeepSeek: { model: "deepseek/deepseek-r1", via: "OpenRouter" },
  "Llama 4 Scout": {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    via: "Groq",
  },
  "Qwen 3": { model: "qwen/qwen3-32b", via: "Groq" },
  "Nemotron Ultra": {
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    via: "OpenRouter",
  },
};

function Panel({
  eyebrow,
  head,
  children,
}: {
  eyebrow: string;
  head: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rules-panel">
      <div className="rules-panel__head">
        <span>{eyebrow}</span>
        <b>{head}</b>
      </div>
      {children}
    </div>
  );
}

export default function MethodologyPage() {
  const models = AI_META.filter((ai) => ai.name !== CONSENSUS_MODEL_NAME);

  return (
    <div className="wrap page">
      <header className="page-head">
        <div className="page-eyebrows reveal">
          <span className="eyebrow">How It Works</span>
          <span className="label-mono">
            {"// SIX MODELS · ONE CONSENSUS · FULL DISCLOSURE"}
          </span>
        </div>
        <h1 className="page-title reveal">
          The <em>Methodology</em>
        </h1>
        <p className="page-intro reveal">
          ORACLE /26 asks a simple question: can a large language model
          actually read a football match? {MODEL_COUNT} independent models
          call an exact score for every World Cup 2026 fixture, and a derived
          seventh entry — the Oracle Consensus — tests whether the crowd of
          machines can beat its smartest member.{" "}
          <b>Everything below is how it really runs, no more, no less.</b>
        </p>
      </header>

      {/* 1 — The contestants */}
      <section className="method-section reveal">
        <span className="section-label">
          1 · The contestants — {MODEL_COUNT} models, {CONTESTANT_COUNT} rows
        </span>
        <div className="method-grid">
          <Panel eyebrow="The models" head="SIX MACHINE MINDS">
            <div>
              {models.map((ai) => {
                const tech = MODEL_TECH[ai.name];
                return (
                  <div className="method-row" key={ai.no}>
                    <span className="method-row__name">
                      {ai.name} <em>· {ai.org}</em>
                    </span>
                    <span className="method-row__tech data">
                      {tech ? `${tech.model} via ${tech.via}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="rules-note">
              Each model predicts independently — none of them sees another
              model&apos;s call.
            </p>
          </Panel>
          <Panel eyebrow="The seventh row" head="ORACLE CONSENSUS · THE HIVE">
            <p className="method-txt">
              The Oracle Consensus is <b>not a seventh AI model</b>. It never
              queries a language model and never generates a prediction of its
              own. It is a derived aggregate: for every match, home goals and
              away goals are each the <b>arithmetic mean</b> of that side&apos;s
              figures across the models that predicted the match, rounded to a
              whole goal with JavaScript&apos;s <code>Math.round</code> —
              exact halves round up (1.5 → 2). Its confidence is the mean of
              the confidences the models reported, rounded the same way. It
              competes on the leaderboard like any other contender, so the
              table shows {CONTESTANT_COUNT} scored entries — six machine
              minds plus one hive.
            </p>
            <p className="method-txt">
              If the averaged knockout scoreline lands level, the consensus
              takes the <b>majority vote</b> of the models&apos; shootout
              picks. Its tournament picks (winner, Golden Boot, Glove, Ball)
              are a per-prize majority vote, grouping spellings that differ
              only in accents; ties break toward the earliest pick.
            </p>
          </Panel>
        </div>
      </section>

      {/* 2 — What the models see */}
      <section className="method-section reveal">
        <span className="section-label">2 · What every model sees</span>
        <div className="method-grid">
          <Panel eyebrow="The prompt" head="SAME DATA FOR ALL">
            <p className="method-txt">
              All six models receive an <b>identical prompt</b> for each
              match: both team names, group, FIFA ranking when available, key
              players (name and position) from each squad, the stage, venue
              and kickoff date. For knockout ties the prompt states the match
              cannot end in a draw — a model calling a level score must also
              name the team it expects to win the penalty shootout.
            </p>
            <p className="method-txt">
              Each model must answer in strict JSON: an exact scoreline, a
              self-reported <b>confidence from 0 to 100</b>, and a
              one-sentence reasoning. Malformed answers get one retry; if that
              also fails, the model simply has no call for that match.
            </p>
            <p className="rules-note">
              No betting odds, live form tables, injury news or other models&apos;
              picks are provided. FIFA rankings are currently not populated by
              the data source and are sent as &quot;unknown&quot;.
              {/* TODO: backfill Team.fifaRanking from an official source so
                  the prompts carry real rankings. */}
            </p>
          </Panel>
          <Panel eyebrow="Collection & locking" head="LOCKED BEFORE KICKOFF">
            <p className="method-txt">
              A scheduled daily update syncs results, scores freshly finished
              matches, then requests predictions for fixtures kicking off{" "}
              <b>within the next 48 hours</b> that are still missing calls. A
              model that failed transiently is retried on later runs — but
              only while the match is still scheduled.
            </p>
            <p className="method-txt">
              Every prediction is written once and <b>never edited</b>: the
              database enforces one row per model per match, rows are
              create-only with a stored timestamp, and only future, scheduled
              matches are ever sent to the models — so no call can be made or
              changed after kickoff. The consensus row is recomputed as late
              model calls arrive, again only pre-kickoff, since it must always
              equal the average of the calls on record.
            </p>
          </Panel>
        </div>
      </section>

      {/* 3 — Scoring */}
      <section className="method-section reveal">
        <span className="section-label">3 · Scoring</span>
        <div className="method-grid">
          <Panel eyebrow="Match points" head={`STACK · MAX ${MATCH_POINTS_MAX}`}>
            <div className="rules-row">
              <span className="tag winner">winner</span>
              <span className="rules-row__label">
                Correct winner — or a correctly called draw
              </span>
              <span className="rules-row__pts">{MATCH_POINTS.winner}</span>
            </div>
            <div className="rules-row">
              <span className="tag gd">goal diff</span>
              <span className="rules-row__label">
                Correct goal difference on top
              </span>
              <span className="rules-row__pts">+{MATCH_POINTS.goalDiff}</span>
            </div>
            <div className="rules-row">
              <span className="tag exact">exact</span>
              <span className="rules-row__label">
                The exact scoreline — the perfect-prediction bonus
              </span>
              <span className="rules-row__pts">+{MATCH_POINTS.exactScore}</span>
            </div>
            <p className="rules-note">
              Shootouts: goal difference and exact score are judged on the
              scoreline the match finished on (regulation plus extra time,
              penalties excluded), while the winner point goes to whoever
              correctly called the side that <b>advanced</b> — matched against
              the model&apos;s own shootout pick when it predicted a draw.
            </p>
          </Panel>
          <Panel eyebrow="Tournament calls" head="SCORED AT THE FINAL">
            <div className="rules-row">
              <span className="tag exact">trophy</span>
              <span className="rules-row__label">World Cup winner</span>
              <span className="rules-row__pts">{TOURNAMENT_POINTS.winner}</span>
            </div>
            <div className="rules-row">
              <span className="tag exact">boot</span>
              <span className="rules-row__label">Golden Boot — top scorer</span>
              <span className="rules-row__pts">
                {TOURNAMENT_POINTS.goldenBoot}
              </span>
            </div>
            <div className="rules-row">
              <span className="tag exact">glove</span>
              <span className="rules-row__label">
                Golden Glove — best goalkeeper
              </span>
              <span className="rules-row__pts">
                {TOURNAMENT_POINTS.goldenGlove}
              </span>
            </div>
            <div className="rules-row">
              <span className="tag exact">ball</span>
              <span className="rules-row__label">
                Golden Ball — best player
              </span>
              <span className="rules-row__pts">
                {TOURNAMENT_POINTS.goldenBall}
              </span>
            </div>
            <p className="rules-note">
              Locked before the opening match, paid out once when the cup is
              decided. The champion is auto-verified from the final&apos;s
              result; Boot, Glove and Ball are checked manually.
            </p>
          </Panel>
        </div>
      </section>

      {/* 4 — Derived numbers */}
      <section className="method-section reveal">
        <span className="section-label">4 · Accuracy &amp; calibration</span>
        <div className="method-grid">
          <Panel eyebrow="Accuracy" head="HOW THE % IS COMPUTED">
            <p className="method-txt">
              <b>Winner accuracy</b> is the share of a contestant&apos;s
              scored matches where it earned the winner point — called the
              right result, shootouts included. <b>Points per match</b> is
              total points divided by scored matches (out of{" "}
              {MATCH_POINTS_MAX}), and <b>perfect predictions</b> counts exact
              scorelines. A match only enters these figures once it has been
              scored.
            </p>
          </Panel>
          <Panel eyebrow="Calibration" head="IS THE CONFIDENCE HONEST?">
            <p className="method-txt">
              Every call carries the model&apos;s self-reported confidence
              (0–100). The Lab groups those into five buckets (0–20, 20–40,
              40–60, 60–80, 80–100) and compares each bucket&apos;s{" "}
              <b>actual hit-rate</b> — the share of predictions that earned
              any points — against the bucket midpoint, the dashed
              &quot;perfectly calibrated&quot; line. A well-calibrated model
              that says 60% should land points about 60% of the time.
            </p>
          </Panel>
        </div>
      </section>

      {/* 5 — Data & honesty */}
      <section className="method-section reveal">
        <span className="section-label">5 · Data sources &amp; limitations</span>
        <div className="method-grid">
          <Panel eyebrow="Data sources" head="WHERE THE FACTS COME FROM">
            <p className="method-txt">
              Fixtures, live status, final results (including extra time and
              penalty shootouts), squads and team crests come from the{" "}
              <b>football-data.org</b> API (v4, World Cup competition feed),
              synced into the league database by the daily update. Predictions,
              scoring and every number on this site are computed from that
              database — nothing is hand-entered.
            </p>
          </Panel>
          <Panel eyebrow="Known limitations" head="READ BEFORE TRUSTING">
            <p className="method-txt">
              Honest caveats: the models&apos; <b>training data</b> may
              include pre-tournament knowledge, so this is a test of applied
              judgement, not clairvoyance. Free-tier gateways occasionally
              fail, so a match can be missing a model&apos;s call — the
              consensus then averages fewer voices, and &quot;matches
              scored&quot; can differ per contestant. Confidence is{" "}
              <b>self-reported</b>, not a market probability. Exact scorelines
              are inherently low-probability calls, so points swing on small
              samples. Squad lists are snapshots without injury or team news,
              and FIFA rankings are currently unavailable to the models.
            </p>
          </Panel>
        </div>
      </section>

      {/* 6 — Built with AI */}
      <section className="method-section reveal">
        <span className="section-label">6 · How this site was built</span>
        <div className="rules-panel">
          <div className="rules-panel__head">
            <span>Disclosure</span>
            <b>AI-ASSISTED DEVELOPMENT</b>
          </div>
          <p className="method-txt">
            ORACLE /26 was designed and built with AI-assisted development
            using Claude Fable 5 through Claude Code. Product direction, system
            design, data decisions, testing and final implementation decisions
            were directed and reviewed by the creator. It felt only fair that
            a site about machine predictions was, itself, partly machine-made.
          </p>
        </div>
      </section>

      <p className="label-mono" style={{ display: "block", marginTop: "2rem" }}>
        Questions the data can&apos;t answer yet get a straight &quot;awaiting
        data&quot; on <Link href="/analytics">The Lab</Link> — never an
        invented number.
      </p>
    </div>
  );
}
