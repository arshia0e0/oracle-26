"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/fixtures", label: "Fixtures" },
  { href: "/prophets", label: "The Prophets" },
  { href: "/leaderboard", label: "Form Table" },
  { href: "/teams", label: "Teams" },
];

export default function Nav() {
  const pathname = usePathname();
  // Match detail pages live under /matches but belong to Fixtures.
  const isActive = (href: string) =>
    pathname.startsWith(href) ||
    (href === "/fixtures" && pathname.startsWith("/matches"));

  return (
    <header className="nav">
      <div className="wrap nav__row">
        <Link className="wordmark" href="/">
          <span className="wordmark__name">ORACLE</span>
          <span className="wordmark__26">/26</span>
        </Link>
        <nav className="nav__links">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                "nav__link" + (isActive(link.href) ? " nav__link--active" : "")
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
