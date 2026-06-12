// ORACLE formation pitch: floodlit-turf panel with chalk markings and a
// 4-3-3 laid out forwards-on-top. Each player is a circular photo node
// (photoUrl from the football-data.org sync when available, otherwise a
// generated UI Avatars portrait) ringed in grass-green, with a shirt
// number badge, name plate, and position tag.

import Link from "next/link";
import type { Player } from "@/lib/generated/prisma/client";

const POSITION_TAGS: Record<string, string> = {
  Goalkeeper: "GK",
  Defence: "DEF",
  Midfield: "MID",
  Offence: "FWD",
};

function lastName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? name;
}

// UI Avatars fallback when the API gave us no photo: initials styled to
// match the floodlit theme (dark disc, grass-green lettering).
function avatarUrl(player: Player): string {
  if (player.photoUrl) return player.photoUrl;
  const parts = player.name.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? player.name;
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const name = encodeURIComponent(last ? `${first} ${last}` : first);
  return `https://ui-avatars.com/api/?name=${name}&background=0d1117&color=4ade80&size=80&bold=true`;
}

// Pick a starting eleven from the squad: 1 GK, 4 DEF, 3 MID, 3 FWD,
// taking the lowest shirt numbers in each position.
export function buildLineup(players: Player[]): {
  forwards: Player[];
  midfielders: Player[];
  defenders: Player[];
  keeper: Player | null;
} {
  const byNumber = [...players]
    .filter((p) => p.position !== "Coach")
    .sort((a, b) => a.shirtNumber - b.shirtNumber);

  const taken = new Set<number>();
  const pick = (position: string, count: number) => {
    const result = byNumber
      .filter((p) => p.position === position && !taken.has(p.id))
      .slice(0, count);
    result.forEach((p) => taken.add(p.id));
    return result;
  };

  const keeper = pick("Goalkeeper", 1)[0] ?? null;
  const defenders = pick("Defence", 4);
  const midfielders = pick("Midfield", 3);
  const forwards = pick("Offence", 3);

  return { forwards, midfielders, defenders, keeper };
}

function PlayerChip({ player }: { player: Player }) {
  return (
    <Link className="player" href={`/players/${player.id}`}>
      <span className="player__photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl(player)} alt={player.name} loading="lazy" />
        <span className="player__num">{player.shirtNumber}</span>
      </span>
      <span className="player__name">{lastName(player.name)}</span>
      <span className="player__pos">
        {POSITION_TAGS[player.position] ?? player.position}
      </span>
    </Link>
  );
}

function PitchRow({ players }: { players: Player[] }) {
  if (players.length === 0) return null;
  return (
    <div className="pitch-row">
      {players.map((p) => (
        <PlayerChip key={p.id} player={p} />
      ))}
    </div>
  );
}

export default function LineupPitch({ players }: { players: Player[] }) {
  const { forwards, midfielders, defenders, keeper } = buildLineup(players);

  return (
    <div className="pitch">
      <div className="pitch-mk" aria-hidden="true">
        <span className="ln" />
        <span className="circ" />
        <span className="box-t" />
        <span className="box-b" />
      </div>
      <div className="pitch-rows">
        <PitchRow players={forwards} />
        <PitchRow players={midfielders} />
        <PitchRow players={defenders} />
        {keeper && <PitchRow players={[keeper]} />}
      </div>
    </div>
  );
}
