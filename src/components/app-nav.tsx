"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MASCOT_NAME } from "./mascot-mood";

/**
 * The app's navigation: a slim glass rail of icons on the left on
 * wide screens, like Muse's sidebar, and a glass tab bar at the bottom on
 * phones. Icons are drawn for Leash; every one has a text label.
 */
const ITEMS: Array<{ href: string; label: string; icon: ReactNode }> = [
  {
    href: "/",
    label: "Home",
    icon: <path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z" />,
  },
  {
    href: "/agent",
    label: MASCOT_NAME,
    icon: <path d="M7.5 4h9A4.5 4.5 0 0 1 21 8.5v5a4.5 4.5 0 0 1-4.5 4.5H11l-5 3.5V17.7A4.5 4.5 0 0 1 3 13.5v-5A4.5 4.5 0 0 1 7.5 4z" />,
  },
  {
    href: "/rules",
    label: "Rules",
    icon: (
      <>
        <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
  },
  {
    href: "/inbox",
    label: "Inbox",
    icon: <path d="M3.5 13 6.5 5h11l3 8v5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zm0 0h5l1.5 2.5h4L15.5 13h5" />,
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  {
    href: "/permissions",
    label: "Permissions",
    icon: <path d="M12 3.5 19 6.5v5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5v-5zM9 12l2 2 4-4" />,
  },
];

/** A page's icon from the nav, for links to it elsewhere (the home page). */
export function NavIcon({ href, size = 24 }: { href: string; size?: number }) {
  const item = ITEMS.find((candidate) => candidate.href === href);
  if (!item) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {item.icon}
    </svg>
  );
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Leash"
      className="glass fixed inset-x-3 bottom-3 z-30 rounded-[28px] px-1 py-1 md:inset-x-auto md:top-3 md:bottom-3 md:left-3 md:w-16 md:px-0 md:py-3"
    >
      <ul className="flex justify-around md:h-full md:flex-col md:items-center md:justify-start md:gap-2">
        {ITEMS.map((item) => {
          const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li
              key={item.href}
              // Settings sit a little apart, but high enough to stay clear of
              // anything in the bottom corner.
              className={item.href === "/permissions" ? "md:mt-2 md:border-t md:border-[var(--border)] md:pt-4" : undefined}
            >
              <Link
                href={item.href}
                title={item.label}
                aria-current={current ? "page" : undefined}
                className={`flex min-w-12 flex-col items-center gap-0.5 rounded-2xl px-1.5 py-1.5 text-[10px] font-medium transition-colors duration-200 active:scale-95 md:size-11 md:justify-center md:p-0 ${
                  current
                    ? "text-accent md:bg-surface-muted"
                    : "text-muted hover:text-foreground md:hover:bg-surface-muted"
                }`}
              >
                <NavIcon href={item.href} />
                <span className="md:sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
