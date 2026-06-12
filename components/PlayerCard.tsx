// Premium collectible trading card for a star player in the ORACLE /26
// brand: dark-green slab in a translucent graded sleeve, holographic
// shimmer that follows the cursor, circular headshot ringed in a national
// colour gradient. Each card is tinted with the player's national colours
// (theme.t1 / theme.t2). When no headshot exists the big shirt number
// takes over as the focal point.
//
// Scroll-driven deal (StarCardDeck): the section stays its natural size
// and the deal is keyed to its travel up the viewport — each stretch of
// scroll deals the next card in from its side of the page onto that
// side's pile. Once every card has landed the spread is latched and no
// longer scroll-linked.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import type { CSSProperties } from "react";

/* SSR-safe media query: renders `false` on the server and on the first
   client paint (matching the server markup, so no hydration mismatch),
   then flips to the real value in an effect and tracks changes. */
function useIsNarrow(maxWidth: number) {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);
  return isNarrow;
}

export type PlayerCardData = {
  /* display surname, already uppercased/shortened (e.g. "VINI JR") */
  cardName: string;
  shirtNumber: number;
  position: string;
  teamName: string;
  flagUrl: string;
  /* /players/<lastname>.png, or null when the file doesn't exist */
  photoUrl: string | null;
  /* national-culture tint: primary and secondary accent colours */
  theme: { t1: string; t2: string };
  /* player detail page, e.g. /players/3218; card becomes a link if set */
  href?: string | null;
};

/* pinned scrollytelling deck: owns the scroll runway and deals the cards
   onto the left / right piles as the user scrolls */
export function StarCardDeck({
  cards,
  header,
}: {
  cards: PlayerCardData[];
  header?: React.ReactNode;
}) {
  const deckRef = useRef<HTMLDivElement>(null);
  // progress runs from the deck entering near the bottom of the viewport
  // to its bottom edge reaching just past the middle — the spread is
  // complete while the whole section is still comfortably on screen
  const { scrollYProgress } = useScroll({
    target: deckRef,
    offset: ["start 0.85", "end 0.55"],
  });

  // On phones the flattened card grid is much taller than the desktop
  // piles, so the same runway would demand far more scrolling: compress
  // it so the full deal lands within the first 40% of the travel. Refs
  // (not state) feed the transform so the per-scroll callback always
  // reads the live values without re-subscribing.
  const isNarrow = useIsNarrow(880);
  const narrowRef = useRef(false);
  narrowRef.current = isNarrow;

  // One-way latch: once the spread is complete it stays put — no
  // re-dealing or end-of-animation jumps when the user keeps scrolling
  // or rubber-bands back up.
  const dealtRef = useRef(false);
  const dealProgress = useTransform(scrollYProgress, (v) => {
    if (dealtRef.current) return 1;
    const scaled = narrowRef.current ? v / 0.4 : v;
    if (scaled >= 1) {
      dealtRef.current = true;
      return 1;
    }
    return scaled;
  });

  const progress = useSpring(dealProgress, {
    stiffness: 170,
    damping: 30,
    mass: 0.6,
  });

  // each card owns an equal slice of the runway; the last 5% is a rest
  // beat where the finished spread just sits
  const slice = 0.95 / cards.length;

  return (
    <div className="stardeck" ref={deckRef}>
      {header}
      <div className="starstacks">
        {(["left", "right"] as const).map((side) => (
          <div className="starstack" key={side}>
            {cards
              .map((card, order) => ({ card, order }))
              .filter(({ order }) =>
                side === "left" ? order % 2 === 0 : order % 2 === 1
              )
              .map(({ card, order }, layer) => (
                <PlayerCard
                  key={card.cardName}
                  player={card}
                  side={side}
                  layer={layer}
                  progress={progress}
                  range={[order * slice, (order + 1) * slice]}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayerCard({
  player,
  side,
  layer,
  progress,
  range,
}: {
  player: PlayerCardData;
  /* which page edge the card flies in from, and which pile it joins */
  side: "left" | "right";
  /* position within its pile — 0 is the bottom card */
  layer: number;
  /* scroll progress through the deck runway, 0 → 1 */
  progress: MotionValue<number>;
  /* the slice of progress during which this card deals in */
  range: [number, number];
}) {
  const cardRef = useRef<HTMLElement>(null);
  const dir = side === "left" ? -1 : 1;

  // scroll-linked deal: off-page edge → pile, reversing on scroll-up
  const x = useTransform(progress, range, [`${dir * 60}vw`, "0vw"]);
  const rotateY = useTransform(progress, range, [dir * 15, 0]);
  const opacity = useTransform(
    progress,
    [range[0], range[0] + (range[1] - range[0]) * 0.5],
    [0, 1]
  );

  // dealt-card resting pose: each layer lands shifted along the pile
  // with a slight crooked rotation, later cards covering earlier ones.
  // `order` is inert here (slots are absolute) but on mobile, where the
  // piles flatten into a grid, it re-pairs the cards by deal order so
  // rows read Messi+Ronaldo, Haaland+Vini, … instead of pile by pile.
  const slotStyle: CSSProperties = {
    left: layer * 52,
    top: layer * 8,
    zIndex: layer + 1,
    transform: `rotate(${dir * (layer * 1.4 - 2)}deg)`,
    order: layer * 2 + (side === "left" ? 0 : 1),
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

  const themeVars = {
    "--t1": player.theme.t1,
    "--t2": player.theme.t2,
  } as CSSProperties;

  const card = (
    <article
      className="pcard"
      ref={cardRef}
      onMouseMove={onMouseMove}
      style={themeVars}
    >
      <div className="pcard__face">
        <header className="pcard__top">
          <span className="pcard__no">{player.shirtNumber}</span>
          <span className="pcard__brand">ORACLE /26</span>
          <span className="pcard__flag">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={player.flagUrl} alt={`${player.teamName} flag`} />
          </span>
        </header>
        {player.photoUrl ? (
          <div className="pcard__photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={player.photoUrl} alt={player.cardName} />
          </div>
        ) : (
          <div className="pcard__number">{player.shirtNumber}</div>
        )}
        <footer className="pcard__bottom">
          <h3 className="pcard__name">{player.cardName}</h3>
          <p className="pcard__meta">
            {player.position} · {player.teamName}
          </p>
        </footer>
        <span className="pcard__shine" aria-hidden />
      </div>
    </article>
  );

  return (
    <div className="pcard-slot" style={slotStyle}>
      <motion.div style={{ x, rotateY, opacity, transformPerspective: 900 }}>
        {player.href ? (
          <Link href={player.href} className="pcard-link">
            {card}
          </Link>
        ) : (
          card
        )}
      </motion.div>
    </div>
  );
}
