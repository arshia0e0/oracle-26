// Premium collectible trading card for a star player in the ORACLE /26
// brand: dark-green slab in a translucent graded sleeve, holographic
// shimmer that follows the cursor, circular headshot ringed in a national
// colour gradient. Each card is tinted with the player's national colours
// (theme.t1 / theme.t2). When no headshot exists the big shirt number
// takes over as the focal point.
//
// Scroll-driven deal (StarCardDeck): the section stays its natural size
// and the deal is keyed to its travel up the viewport — each stretch of
// scroll deals the next card in from its side of the page into the fan.
// The eight cards land in a single hand-of-cards fan (each rotated a few
// degrees more than the last, tops curving like cards held in a hand).
// Once every card has landed the spread is latched and no longer
// scroll-linked, and React swaps to a fully static render.
//
// The same scroll-linked pipeline drives both viewports; on narrow
// screens the raw progress is divided by 0.35 so the full deal lands
// within the first third of the runway (the flattened 2-column card grid
// is much taller than the desktop fan, so the same runway would demand
// far more scrolling), and the mobile CSS flattens the fan into a 2-up
// grid.

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

/* ---------------------------------------------------------------------------
   Hand-of-cards fan geometry
   ---------------------------------------------------------------------------
   Each of the N cards rests in a slot keyed off its deal order. Cards
   fan out across the row, each rotated a few degrees more than the last,
   their tops curving upward in the middle like cards held in a hand.

   .pcard is 200px wide on desktop. Spacing card centres ~118px apart
   gives a ~41% overlap (200-118 = 82px hidden) while every name/face
   stays visible; 8 cards span 7*118 + 200 = 1026px, comfortably inside
   the 1180px content width. The fan is centred about its midpoint so it
   sits in the middle of the .starstacks box. */
const CARD_W = 200;
const FAN_STEP_X = 118; // horizontal distance between adjacent card centres
const FAN_ROT = 4; // degrees added per card away from centre
const FAN_ARC = 4.2; // vertical curve strength (px per step²)

function fanSlot(order: number, count: number): CSSProperties {
  const mid = (count - 1) / 2;
  const off = order - mid; // signed distance from the centre slot
  // horizontal: spread about the centre of the .starstacks box
  const x = off * FAN_STEP_X - CARD_W / 2;
  // vertical arc: middle cards ride higher, edges dip — tops form a curve
  const y = off * off * FAN_ARC;
  return {
    left: "50%",
    top: 0,
    marginLeft: `${x}px`,
    marginTop: `${y}px`,
    // rotation lives on a custom property so the card body (.pcard) can
    // apply it as its resting tilt and the :hover rule can cleanly swap
    // to an upright, lifted pose
    ["--fan-rot" as string]: `${off * FAN_ROT}deg`,
    // left→right stacking so each card tucks under the next
    zIndex: order + 1,
  } as CSSProperties;
}

/* deck entry point: one scroll-linked deal drives both viewports. The
   first client paint always renders with the cards hidden off-page by
   their initial MotionValues (matching SSR markup); narrow viewports
   only change the runway scaling, handled via a ref so there is no
   hydration-sensitive branch in the markup. */
export function StarCardDeck({
  cards,
  header,
}: {
  cards: PlayerCardData[];
  header?: React.ReactNode;
}) {
  const deckRef = useRef<HTMLDivElement>(null);
  // progress runs from the moment the deck enters the viewport (so the
  // first card starts moving right away) to its bottom edge reaching
  // just past the middle — the spread is complete while the whole
  // section is still comfortably on screen
  const { scrollYProgress } = useScroll({
    target: deckRef,
    offset: ["start 1", "end 0.55"],
  });

  // On phones the flattened card grid is much taller than the desktop
  // fan, so the same runway would demand far more scrolling: compress it
  // so the full deal lands within the first 35% of the travel. Refs (not
  // state) feed the transform so the per-scroll callback always reads the
  // live value without re-subscribing.
  const isNarrow = useIsNarrow(880);
  const narrowRef = useRef(false);
  narrowRef.current = isNarrow;

  // One-way latch: once the spread is complete it stays put — no
  // re-dealing or end-of-animation jumps when the user keeps scrolling
  // or rubber-bands back up. `dealt` (state) flips React over to a fully
  // static render so the cards stop costing any per-frame work: see below.
  const dealtRef = useRef(false);
  const [dealt, setDealt] = useState(false);
  const dealProgress = useTransform(scrollYProgress, (v) => {
    if (dealtRef.current) return 1;
    const scaled = narrowRef.current ? v / 0.35 : v;
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

  // The latch above pins the spread, but the spring + the 8×3 per-card
  // transforms stay subscribed to scrollYProgress for the rest of the
  // session — recomputing and mutating inline styles on every scroll
  // event (and the spring keeps settling after scroll stops, so the page
  // lags behind the thumb). Once the spring has actually arrived at 1 we
  // flip `dealt`, after which each card renders a plain static element
  // with no MotionValues and no 3D transform — zero per-frame cost.
  useEffect(() => {
    if (dealt) return;
    const unsub = progress.on("change", (v) => {
      if (v >= 0.999) {
        progress.set(1);
        setDealt(true);
      }
    });
    return unsub;
  }, [progress, dealt]);

  // each card owns an equal slice of the runway; the last 5% is a rest
  // beat where the finished spread just sits
  const slice = 0.95 / cards.length;

  // even deal order flies in from the left page edge, odd from the right,
  // alternating like a real deal — but every card lands in one shared fan
  return (
    <div className="stardeck" ref={deckRef}>
      {header}
      <div className="starstacks">
        {cards.map((card, order) => (
          <PlayerCard
            key={card.cardName}
            player={card}
            side={order % 2 === 0 ? "left" : "right"}
            order={order}
            count={cards.length}
            progress={progress}
            range={[order * slice, (order + 1) * slice]}
            dealt={dealt}
          />
        ))}
      </div>
    </div>
  );
}

export default function PlayerCard({
  player,
  side,
  order,
  count,
  progress,
  range,
  dealt,
}: {
  player: PlayerCardData;
  /* which page edge the card flies in from */
  side: "left" | "right";
  /* deal order across the whole fan — 0 is the first card dealt */
  order: number;
  /* total number of cards in the fan */
  count: number;
  /* scroll progress through the deck runway, 0 → 1 */
  progress: MotionValue<number>;
  /* the slice of progress during which this card deals in */
  range: [number, number];
  /* true once the whole spread has landed: render statically from here */
  dealt: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const dir = side === "left" ? -1 : 1;

  // scroll-linked deal: off-page edge → fan slot, reversing on scroll-up
  const x = useTransform(progress, range, [`${dir * 60}vw`, "0vw"]);
  const rotateY = useTransform(progress, range, [dir * 15, 0]);
  const opacity = useTransform(
    progress,
    [range[0], range[0] + (range[1] - range[0]) * 0.5],
    [0, 1]
  );

  // resting pose: each card lands in its fan slot. `order` re-pairs the
  // cards on mobile too, where the fan flattens into a grid, so rows read
  // Messi+Ronaldo, Haaland+Vini, … in deal order.
  const slotStyle: CSSProperties = {
    ...fanSlot(order, count),
    order,
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
            {/* eager + low priority: fetch/decode the headshots in the
                background well before the deal, instead of lazy-loading
                them so the decode lands mid-animation — but without
                competing with the above-the-fold hero for bandwidth.
                (lowercase `fetchpriority`: React 18 passes unknown
                lowercase attributes straight through to the DOM.) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={player.photoUrl}
              alt={player.cardName}
              width={124}
              height={124}
              loading="eager"
              decoding="async"
              {...({ fetchpriority: "low" } as object)}
            />
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

  const inner = player.href ? (
    <Link href={player.href} className="pcard-link">
      {card}
    </Link>
  ) : (
    card
  );

  return (
    <div className="pcard-slot" style={slotStyle}>
      {dealt ? (
        // Latched: a plain div with no MotionValues and no 3D transform.
        // Nothing here is subscribed to scroll or the spring, and the
        // card is no longer promoted to its own 3D layer — so once the
        // deal lands the cards cost essentially zero per-frame work.
        <div>{inner}</div>
      ) : (
        <motion.div style={{ x, rotateY, opacity, transformPerspective: 900 }}>
          {inner}
        </motion.div>
      )}
    </div>
  );
}
