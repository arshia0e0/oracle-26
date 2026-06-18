// Auto-generated social share image for a match, 1200×630. Rendered by
// next/og at request time so the score/teams are always current. We load the
// Anton TTF from /public ourselves (via fs, not a file:// URL) because
// @vercel/og's bundled default-font loader breaks on Windows paths that
// contain spaces; reading the file directly works everywhere.

import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const alt = "ORACLE /26 — match prediction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STAGE_LABELS: Record<string, string> = {
  GROUP: "Group Stage",
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER: "Quarter-final",
  SEMI: "Semi-final",
  FINAL: "Final",
};

export default async function Image({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const match = Number.isInteger(id)
    ? await prisma.match.findUnique({
        where: { id },
        include: { homeTeam: true, awayTeam: true },
      })
    : null;

  const ink = "#060d09";
  const grass = "#9bf0b0";
  const chalk = "#f1eee2";
  const faint = "#6c7268";

  const home = match?.homeTeam.name ?? "TBD";
  const away = match?.awayTeam.name ?? "TBD";
  const finished = match?.status === "FINISHED";
  const live = match?.status === "LIVE";
  const center =
    match && (finished || live)
      ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`
      : "V";
  const stage = match?.group
    ? `Group ${match.group}`
    : match
    ? STAGE_LABELS[match.stage] ?? match.stage
    : "";
  const tag = finished ? "Full time" : live ? "Live" : "Six AIs have called it";

  const fontData = await readFile(
    path.join(process.cwd(), "public/fonts/Anton-Regular.ttf")
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(160deg, #08130c 0%, ${ink} 55%, #050b07 100%)`,
          color: chalk,
          fontFamily: "Anton",
          padding: "70px 80px",
          justifyContent: "space-between",
        }}
      >
        {/* top accent + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 46, height: 8, background: grass }} />
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 2,
              display: "flex",
              gap: 8,
            }}
          >
            <span>ORACLE</span>
            <span style={{ color: grass }}>/26</span>
          </div>
        </div>

        {/* teams + score */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              fontSize: 64,
              fontWeight: 800,
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {home}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 800,
              color: grass,
              padding: "0 20px",
            }}
          >
            {center}
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "flex-end",
              textAlign: "right",
              fontSize: 64,
              fontWeight: 800,
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {away}
          </div>
        </div>

        {/* footer meta */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            letterSpacing: 1,
            color: faint,
            textTransform: "uppercase",
          }}
        >
          <span style={{ display: "flex" }}>{stage}</span>
          <span style={{ display: "flex", color: live ? "#ff4438" : grass }}>
            {tag}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Anton", data: fontData, style: "normal", weight: 400 },
      ],
    }
  );
}
