// Nation chip in the ORACLE kit-chip frame — a bordered, shadowed slab
// holding the team flag.

import type { Team } from "@/lib/generated/prisma/client";

export default function FlagChip({
  team,
  size = "md",
}: {
  team: Team;
  size?: "md" | "lg";
}) {
  const w = size === "lg" ? 64 : 54;
  const h = size === "lg" ? 44 : 38;
  return (
    <span className="kit-chip" style={{ width: w, height: h }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.flagUrl} alt={`${team.name} flag`} />
    </span>
  );
}
