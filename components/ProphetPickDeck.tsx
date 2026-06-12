// A prophet's tournament picks as a dealt pile of the homepage-style
// collectible cards: one card each for its World Cup winner, Golden
// Boot and Golden Glove call. The corner number is the points at stake
// for that pick, the round photo is the player headshot (or the
// nation's crest for the winner card; initials when no image exists).
//
// Unlike the homepage deck the deal is not scroll-scrubbed: when the
// prophet row reaches the viewport the cards fly in once from the
// row's empty side, one by one, and land on the pile.

"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { CSSProperties } from "react";

export type PickDeckCardData = {
  /* "Winner" | "Golden Boot" | "Golden Glove" | "Golden Ball" */
  label: string;
  /* points at stake for getting this pick right — the corner number */
  points: number;
  /* country or player name as the AI wrote it */
  name: string;
  /* round-photo image: player headshot or nation crest; null → initials */
  imageUrl: string | null;
  /* small corner flag (the pick's nation), or null to omit */
  flagUrl: string | null;
  /* national tint; null keeps the default sleeve colours */
  theme: { t1: string; t2: string } | null;
};

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function PickCard({
  card,
  side,
  layer,
  dealt,
}: {
  card: PickDeckCardData;
  side: "left" | "right";
  /* position within the pile — 0 deals first and sits at the bottom */
  layer: number;
  /* true once the deck container has entered the viewport */
  dealt: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const dir = side === "left" ? -1 : 1;

  // Desktop: cards are laid out in a horizontal flex row — no pile offsets.
  // A small alternating tilt (odd layers lean one way, even the other) keeps
  // the playful feel without any overlap. Mobile CSS overrides to no rotation.
  const tilt = (layer % 2 === 0 ? 1 : -1) * 1.5;
  const slotStyle: CSSProperties = {
    // left/top offsets intentionally removed; flex container handles spacing
    zIndex: layer + 1,
    transform: `rotate(${tilt}deg)`,
  };

  function onMouseMove(e: React.MouseEvent<HTMLElement>) {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 100;
    const my = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--mx", `${mx}%`);
    el.style.setProperty("--my", `${my}%`);
    el.style.setProperty("--ha", `${115 + (mx - 50) * 0.9}deg`);
  }

  const themeVars = (
    card.theme ? { "--t1": card.theme.t1, "--t2": card.theme.t2 } : {}
  ) as CSSProperties;

  return (
    <div className="pcard-slot" style={slotStyle}>
      <motion.div
        initial={{ x: `${dir * 60}vw`, rotateY: dir * 16, opacity: 0 }}
        animate={dealt ? { x: "0vw", rotateY: 0, opacity: 1 } : undefined}
        transition={{
          type: "spring",
          stiffness: 80,
          damping: 17,
          mass: 0.9,
          delay: layer * 0.22,
        }}
        style={{ transformPerspective: 900 }}
      >
        <article
          className="pcard"
          ref={cardRef}
          onMouseMove={onMouseMove}
          style={themeVars}
        >
          <div className="pcard__face">
            <header className="pcard__top">
              <span className="pcard__no">{card.points}</span>
              <span className="pcard__brand">ORACLE /26</span>
              {card.flagUrl ? (
                <span className="pcard__flag">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.flagUrl} alt={`${card.name} flag`} />
                </span>
              ) : (
                <span />
              )}
            </header>
            <div className="pcard__photo">
              {card.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={card.imageUrl} alt={card.name} />
              ) : (
                <span className="pickdeck__init">{initials(card.name)}</span>
              )}
            </div>
            <footer className="pcard__bottom">
              <h3 className="pcard__name">{card.name}</h3>
              <p className="pcard__meta">
                {card.label} · {card.points} pts
              </p>
            </footer>
            <span className="pcard__shine" aria-hidden />
          </div>
        </article>
      </motion.div>
    </div>
  );
}

export default function ProphetPickDeck({
  cards,
  side,
}: {
  cards: PickDeckCardData[];
  /* which page edge the cards fly in from (= the row's empty side) */
  side: "left" | "right";
}) {
  // Watch the static deck container, not the cards themselves: the cards
  // start translated ±60vw offscreen, so an IntersectionObserver on the
  // card never fires on wide viewports and the pile would stay invisible.
  const deckRef = useRef<HTMLDivElement>(null);
  const dealt = useInView(deckRef, { once: true, amount: 0.3 });

  return (
    <div className="pickdeck" ref={deckRef}>
      {cards.map((card, layer) => (
        <PickCard
          key={card.label}
          card={card}
          side={side}
          layer={layer}
          dealt={dealt}
        />
      ))}
    </div>
  );
}
