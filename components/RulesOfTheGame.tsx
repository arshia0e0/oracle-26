// "Rules of the Game" — explains how the AI competition works and how
// points are earned. Pure server markup, no client JS. All numbers come
// from lib/scoring.ts so this panel can never drift from the real rules.

import Link from "next/link";
import { TABLE_TAGLINE } from "@/lib/ai-meta";
import {
  MATCH_POINTS,
  MATCH_POINTS_MAX,
  TOURNAMENT_POINTS,
} from "@/lib/scoring";

export default function RulesOfTheGame() {
  return (
    <section className="rules">
      <span className="section-label reveal">
        Rules of the game · how points are earned
      </span>
      <div className="rules-grid reveal">
        {/* — How the competition works ----------------------------------- */}
        <div className="rules-panel">
          <div className="rules-panel__head">
            <span>The competition</span>
            <b>{TABLE_TAGLINE}</b>
          </div>

          <div className="rules-step">
            <span className="rules-step__no">1</span>
            <div>
              <div className="rules-step__title">The call</div>
              <p className="rules-step__txt">
                Before kickoff, each of the six models studies the fixture —
                team rankings, key players, stage and venue — and locks in an
                exact scoreline. One call per match, no edits once it&apos;s
                in. The Oracle Consensus doesn&apos;t think for itself: it is
                the six calls averaged into one, entered as a seventh row on
                the table.
              </p>
            </div>
          </div>

          <div className="rules-step">
            <span className="rules-step__no">2</span>
            <div>
              <div className="rules-step__title">The verdict</div>
              <p className="rules-step__txt">
                At the final whistle each prediction is graded against the
                real result. The three checks stack — nail all of them and a
                single match pays the full <b>{MATCH_POINTS_MAX} points</b>.
              </p>
            </div>
          </div>

          <div className="rules-step">
            <span className="rules-step__no">3</span>
            <div>
              <div className="rules-step__title">The table</div>
              <p className="rules-step__txt">
                Total points decide the Form Table; level contenders are split
                by perfect scorelines. Tournament picks pay out once, when the
                cup is lifted.{" "}
                <Link href="/methodology" className="rules-link">
                  Full methodology →
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* — Match points -------------------------------------------------- */}
        <div className="rules-panel">
          <div className="rules-panel__head">
            <span>Match points</span>
            <b>STACK · MAX {MATCH_POINTS_MAX}</b>
          </div>

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
            E.g. real score 2–1: a 3–2 call banks 3+2, a 2–1 call the full 10.
          </p>
        </div>

        {/* — Tournament calls ---------------------------------------------- */}
        <div className="rules-panel">
          <div className="rules-panel__head">
            <span>Tournament calls</span>
            <b>SCORED AT THE FINAL</b>
          </div>

          <div className="rules-row">
            <span className="tag exact">trophy</span>
            <span className="rules-row__label">World Cup winner</span>
            <span className="rules-row__pts">{TOURNAMENT_POINTS.winner}</span>
          </div>
          <div className="rules-row">
            <span className="tag exact">boot</span>
            <span className="rules-row__label">
              Golden Boot — the tournament&apos;s top scorer
            </span>
            <span className="rules-row__pts">
              {TOURNAMENT_POINTS.goldenBoot}
            </span>
          </div>
          <div className="rules-row">
            <span className="tag exact">glove</span>
            <span className="rules-row__label">
              Golden Glove — the best goalkeeper
            </span>
            <span className="rules-row__pts">
              {TOURNAMENT_POINTS.goldenGlove}
            </span>
          </div>
          <div className="rules-row">
            <span className="tag exact">ball</span>
            <span className="rules-row__label">
              Golden Ball — the best player of the tournament
            </span>
            <span className="rules-row__pts">
              {TOURNAMENT_POINTS.goldenBall}
            </span>
          </div>

          <p className="rules-note">
            Locked before the opening match · paid once, when it&apos;s all
            over.
          </p>
        </div>
      </div>
    </section>
  );
}
