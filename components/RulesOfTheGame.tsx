// "Rules of the Game" — explains how the AI competition works and how
// points are earned. Pure server markup, no client JS. The numbers here
// mirror lib/scoring.ts exactly (3 / +2 / +5 per match, max 10; tournament
// picks pay 100 / 150 / 150 once the cup is decided).

import { TOURNAMENT_POINTS } from "@/lib/scoring";

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
            <b>SIX ORACLES · ONE TABLE</b>
          </div>

          <div className="rules-step">
            <span className="rules-step__no">1</span>
            <div>
              <div className="rules-step__title">The call</div>
              <p className="rules-step__txt">
                Before kickoff, every oracle studies the fixture — FIFA
                rankings, key players, stage and venue — and locks in an exact
                scoreline. One call per match, no edits once it&apos;s in.
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
                single match pays the full <b>10 points</b>.
              </p>
            </div>
          </div>

          <div className="rules-step">
            <span className="rules-step__no">3</span>
            <div>
              <div className="rules-step__title">The table</div>
              <p className="rules-step__txt">
                Total points decide the Form Table; level oracles are split by
                perfect scorelines. Tournament picks pay out once, when the
                cup is lifted.
              </p>
            </div>
          </div>
        </div>

        {/* — Match points -------------------------------------------------- */}
        <div className="rules-panel">
          <div className="rules-panel__head">
            <span>Match points</span>
            <b>STACK · MAX 10</b>
          </div>

          <div className="rules-row">
            <span className="tag winner">winner</span>
            <span className="rules-row__label">
              Correct winner — or a correctly called draw
            </span>
            <span className="rules-row__pts">3</span>
          </div>
          <div className="rules-row">
            <span className="tag gd">goal diff</span>
            <span className="rules-row__label">
              Correct goal difference on top
            </span>
            <span className="rules-row__pts">+2</span>
          </div>
          <div className="rules-row">
            <span className="tag exact">exact</span>
            <span className="rules-row__label">
              The exact scoreline — the perfect-prediction bonus
            </span>
            <span className="rules-row__pts">+5</span>
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
