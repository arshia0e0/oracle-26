// Premium collectible trading card for a star player in the ORACLE /26
// brand: dark-green slab in a translucent graded sleeve, holographic
// shimmer that follows the cursor, circular headshot ringed in a national
// colour gradient. Each card is tinted with the player's national colours
// (theme.t1 / theme.t2). When no headshot exists the big shirt number
// takes over as the focal point.
//
// The deal (StarCardDeck) has two implementations chosen by viewport:
//
// - Desktop (>880px): scroll-linked. Cards deal in from the page edges
//   onto the two piles as the section travels up the viewport, driven by
//   useScroll → spring → per-card transforms. Once every card has landed
//   the spread latches and React swaps to a fully static render.
//
// - Mobile (<=880px): time-based. Driving 8 cards × 3 MotionValues
//   through a spring on every scroll event — while 3D-rotating large
//   headshots over blend-mode layers — janks on phone GPUs/main threads.
//   So on narrow screens the deck renders statically from the start and
//   a single IntersectionObserver adds an `is-dealt` class when the deck
//   scrolls into view; pure CSS keyframes (transform + opacity only, no
//   rotateY/perspective) stagger the cards in from the sides. The
//   animation runs on the compositor, never re-renders React, and goes
//   fully idle on its own when it finishes.

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

/* split a deal-ordered card list into the two piles: evens deal onto the
   left pile, odds onto the right, alternating like a real card deal */
function pile(cards: PlayerCardData[], side: "left" | "right") {
  return cards
    .map((card, order) => ({ card, order }))
    .filter(({ order }) => (side === "left" ? order % 2 === 0 : order % 2 === 1));
}

/* deck entry point: picks the scroll-linked desktop deal or the
   compositor-driven mobile deal. The first client paint always renders
   the desktop variant (matching SSR markup — cards hidden off-page by
   their initial MotionValues), then narrow viewports swap once, long
   before the user has scrolled down to the deck. */
export function StarCardDeck({
  cards,
  header,
}: {
  cards: PlayerCardData[];
  header?: React.ReactNode;
}) {
  const isNarrow = useIsNarrow(880);
  return isNarrow ? (
    <MobileStarCardDeck cards={cards} header={header} />
  ) : (
    <ScrollStarCardDeck cards={cards} header={header} />
  );
}

/* ---------------------------------------------------------------------------
   Desktop: scroll-linked scrollytelling deal
   ------------------------------------------------------------------------- */
function ScrollStarCardDeck({
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

  // One-way latch: once the spread is complete it stays put — no
  // re-dealing or end-of-animation jumps when the user keeps scrolling
  // or rubber-bands back up. `dealt` (state) flips React over to a fully
  // static render so the cards stop costing any per-frame work: see below.
  const dealtRef = useRef(false);
  const [dealt, setDealt] = useState(false);
  const dealProgress = useTransform(scrollYProgress, (v) => {
    if (dealtRef.current) return 1;
    if (v >= 1) {
      dealtRef.current = true;
      return 1;
    }
    return v;
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

  return (
    <div className="stardeck" ref={deckRef}>
      {header}
      <div className="starstacks">
        {(["left", "right"] as const).map((side) => (
          <div className="starstack" key={side}>
            {pile(cards, side).map(({ card, order }, layer) => (
              <PlayerCard
                key={card.cardName}
                player={card}
                side={side}
                layer={layer}
                progress={progress}
                range={[order * slice, (order + 1) * slice]}
                dealt={dealt}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Mobile: one-shot CSS stagger deal
   ------------------------------------------------------------------------- */
function MobileStarCardDeck({
  cards,
  header,
}: {
  cards: PlayerCardData[];
  header?: React.ReactNode;
}) {
  const deckRef = useRef<HTMLDivElement>(null);

  // Add `is-dealt` straight on the DOM node (no setState → no React
  // re-render mid-scroll) the moment the deck approaches the viewport.
  // The CSS keyframes take it from there entirely off the main thread.
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-dealt");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-dealt");
          io.disconnect();
        }
      },
      // fire when the deck's top edge is ~8% up from the bottom of the
      // viewport — the first cards are just becoming visible
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="stardeck stardeck--mobile" ref={deckRef}>
      {header}
      <div className="starstacks">
        {(["left", "right"] as const).map((side) => (
          <div className="starstack" key={side}>
            {pile(cards, side).map(({ card, order }, layer) => (
              <StaticStarCard
                key={card.cardName}
                player={card}
                side={side}
                layer={layer}
                order={order}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* a card in the mobile deck: plain static markup; the fly-in is pure CSS
   keyed off the slot's --deal-dx / --deal-delay custom properties */
function StaticStarCard({
  player,
  side,
  layer,
  order,
}: {
  player: PlayerCardData;
  side: "left" | "right";
  layer: number;
  order: number;
}) {
  const dir = side === "left" ? -1 : 1;
  const slotStyle: CSSProperties = {
    left: layer * 52,
    top: layer * 8,
    zIndex: layer + 1,
    transform: `rotate(${dir * (layer * 1.4 - 2)}deg)`,
    // CSS `order` re-pairs the flattened grid by deal order so rows read
    // Messi+Ronaldo, Haaland+Vini, … instead of pile by pile
    order: layer * 2 + (side === "left" ? 0 : 1),
  };
  const dealStyle = {
    "--deal-dx": `${dir * 60}vw`,
    "--deal-delay": `${order * 90}ms`,
  } as CSSProperties;
  return (
    <div className="pcard-slot" style={slotStyle}>
      <div className="pcard-deal" style={dealStyle}>
        <CardBody player={player} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Desktop card: scroll-linked deal wrapper around the shared card body
   ------------------------------------------------------------------------- */
export default function PlayerCard({
  player,
  side,
  layer,
  progress,
  range,
  dealt,
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
  /* true once the whole spread has landed: render statically from here */
  dealt: boolean;
}) {
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
  // with a slight crooked rotation, later cards covering earlier ones
  const slotStyle: CSSProperties = {
    left: layer * 52,
    top: layer * 8,
    zIndex: layer + 1,
    transform: `rotate(${dir * (layer * 1.4 - 2)}deg)`,
    order: layer * 2 + (side === "left" ? 0 : 1),
  };

  return (
    <div className="pcard-slot" style={slotStyle}>
      {dealt ? (
        // Latched: a plain div with no MotionValues and no 3D transform.
        // Nothing here is subscribed to scroll or the spring, and the
        // card is no longer promoted to its own 3D layer — so once the
        // deal lands the cards cost essentially zero per-frame work.
        <div>
          <CardBody player={player} />
        </div>
      ) : (
        <motion.div style={{ x, rotateY, opacity, transformPerspective: 900 }}>
          <CardBody player={player} />
        </motion.div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Shared card body (sleeve, face, headshot, shine) — used by both deals
   ------------------------------------------------------------------------- */
function CardBody({ player }: { player: PlayerCardData }) {
  const cardRef = useRef<HTMLElement>(null);

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

  return player.href ? (
    <Link href={player.href} className="pcard-link">
      {card}
    </Link>
  ) : (
    card
  );
}
