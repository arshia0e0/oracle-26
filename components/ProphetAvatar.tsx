// Generated SVG portrait for each AI prophet — a lab-coloured field with a
// unique line emblem and the model's monogram. No external assets, scales
// crisply, and stays on-brand with the ORACLE sticker. Override later by
// dropping a file in /public/prophets and passing `imageUrl`.

type Spec = {
  c1: string; // gradient top
  c2: string; // gradient bottom
  emblem: "openai" | "gemini" | "deepseek" | "meta" | "qwen" | "nvidia" | "hive";
};

// Keyed by the canonical aiModel name (see AI_META).
const SPECS: Record<string, Spec> = {
  "GPT-5-mini": { c1: "#10a37f", c2: "#0a5f4a", emblem: "openai" },
  "Gemini Flash": { c1: "#4285f4", c2: "#1a3fa8", emblem: "gemini" },
  DeepSeek: { c1: "#5b76ff", c2: "#2230a8", emblem: "deepseek" },
  "Llama 4 Scout": { c1: "#0a7cff", c2: "#0a3aa0", emblem: "meta" },
  "Qwen 3": { c1: "#ff7a1f", c2: "#b33d00", emblem: "qwen" },
  "Nemotron Ultra": { c1: "#86c80a", c2: "#3f6b00", emblem: "nvidia" },
  "Oracle Consensus": { c1: "#2ec480", c2: "#caa23a", emblem: "hive" },
};

const FALLBACK: Spec = { c1: "#5a6b62", c2: "#26302b", emblem: "hive" };

const stroke = "rgba(255,255,255,0.92)";

function Emblem({ kind }: { kind: Spec["emblem"] }) {
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "openai": // interlocking hex knot
      return (
        <g {...common} opacity={0.95}>
          <polygon points="50,16 80,33 80,67 50,84 20,67 20,33" />
          <polygon points="50,30 68,40 68,60 50,70 32,60 32,40" opacity={0.7} />
          <circle cx="50" cy="50" r="5" fill={stroke} stroke="none" />
        </g>
      );
    case "gemini": // four-point spark
      return (
        <path
          {...common}
          d="M50 14 C54 38 62 46 86 50 C62 54 54 62 50 86 C46 62 38 54 14 50 C38 46 46 38 50 14 Z"
        />
      );
    case "deepseek": // deep waves
      return (
        <g {...common}>
          <path d="M18 38 Q34 26 50 38 T82 38" />
          <path d="M18 52 Q34 40 50 52 T82 52" opacity={0.85} />
          <path d="M18 66 Q34 54 50 66 T82 66" opacity={0.7} />
        </g>
      );
    case "meta": // infinity loop
      return (
        <path
          {...common}
          d="M30 50 C30 34 50 34 50 50 C50 66 70 66 70 50 C70 34 50 34 50 50 C50 66 30 66 30 50 Z"
        />
      );
    case "qwen": // overlapping circles (venn)
      return (
        <g {...common}>
          <circle cx="40" cy="44" r="20" />
          <circle cx="60" cy="44" r="20" opacity={0.85} />
          <circle cx="50" cy="62" r="20" opacity={0.7} />
        </g>
      );
    case "nvidia": // square eye spiral
      return (
        <g {...common}>
          <path d="M24 24 H76 V76 H30 V34 H66 V66 H40 V44 H56" />
        </g>
      );
    case "hive": // constellation converging to centre
    default:
      return (
        <g {...common}>
          <circle cx="50" cy="50" r="5" fill={stroke} stroke="none" />
          {[
            [24, 28],
            [78, 32],
            [20, 66],
            [80, 70],
            [50, 18],
            [50, 82],
          ].map(([x, y], i) => (
            <g key={i}>
              <line x1="50" y1="50" x2={x} y2={y} opacity={0.45} />
              <circle cx={x} cy={y} r="3.4" fill={stroke} stroke="none" />
            </g>
          ))}
        </g>
      );
  }
}

export default function ProphetAvatar({
  name,
  short,
  imageUrl,
}: {
  name: string;
  short: string;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    // Drop-in override (e.g. a real logo or AI portrait in /public/prophets).
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="sticker__avatar" src={imageUrl} alt={name} />;
  }

  const spec = SPECS[name] ?? FALLBACK;
  const gid = `pa-${spec.emblem}-${short}`;
  return (
    <svg
      className="sticker__avatar"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${name} emblem`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={spec.c1} />
          <stop offset="1" stopColor={spec.c2} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      {/* soft glow behind the emblem */}
      <circle cx="50" cy="48" r="34" fill="rgba(255,255,255,0.08)" />
      <Emblem kind={spec.emblem} />
    </svg>
  );
}
