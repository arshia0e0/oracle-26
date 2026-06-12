// Static page chrome for the ORACLE design: the floodlit-night backdrop,
// the faint chalk pitch markings, and the footer. All purely presentational.

export function FieldBg() {
  return <div className="field-bg" aria-hidden="true" />;
}

export function PitchMarks() {
  return (
    <svg
      className="pitch-marks"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#f1eee2" strokeWidth="1.4">
        <line x1="720" y1="0" x2="720" y2="900" />
        <circle cx="720" cy="450" r="120" />
        <circle cx="720" cy="450" r="3" fill="#f1eee2" />
        <rect x="0" y="300" width="150" height="300" />
        <rect x="1290" y="300" width="150" height="300" />
      </g>
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__row">
        <span className="footer__mark">ORACLE</span>
        <div className="footer__meta">
          THE BEAUTIFUL GAME, COMPUTED
          <br />
          WORLD CUP 2026 · AI PREDICTION LEAGUE
          <br />
          FIVE MACHINES · ONE TROPHY
        </div>
      </div>
    </footer>
  );
}
