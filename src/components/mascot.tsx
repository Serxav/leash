"use client";

import { useEffect, useId, useRef, useState, type Ref } from "react";
import { MASCOT_NAME, type MascotMood } from "./mascot-mood";

/**
 * Rex, the shopping agent's mascot: a puppy on a leash, drawn for
 * Leash (no third-party art). It perks up while the user types, works at a
 * tiny laptop while the agent runs, and afterwards mirrors what Leash's
 * code decided. The status text next to it always says the same in words.
 *
 * Interactive version: the eyes follow the pointer and a tap pats Rex.
 * Both are off for people who ask the system for reduced motion.
 */
export function Mascot({
  mood,
  size = 160,
  framing = "full",
  interactive = false,
  className = "",
}: {
  mood: MascotMood;
  size?: number;
  /** "tile" crops to Rex alone, for the small avatar at the top of the chat. */
  framing?: "full" | "tile";
  interactive?: boolean;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);
  const [pats, setPats] = useState(0);
  const [patted, setPatted] = useState(false);

  useEffect(() => {
    if (!interactive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const follow = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = svgRef.current;
        const pupils = pupilsRef.current;
        if (!svg || !pupils) return;
        const box = svg.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.4);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(3, distance / 40);
        pupils.setAttribute(
          "transform",
          `translate(${((dx / distance) * reach).toFixed(2)} ${((dy / distance) * reach).toFixed(2)})`,
        );
      });
    };
    window.addEventListener("pointermove", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", follow);
    };
  }, [interactive]);

  useEffect(() => {
    if (!patted) return;
    const timer = setTimeout(() => setPatted(false), 1200);
    return () => clearTimeout(timer);
  }, [patted, pats]);

  // The tile is Rex's head and chest, like an app icon; no leash there.
  const [x, y, width, height] = framing === "tile" ? [28, 30, 134, 134] : [0, 0, 220, 200];
  const picture = (
    <svg
      ref={svgRef}
      viewBox={`${x} ${y} ${width} ${height}`}
      width={size}
      height={Math.round((size * height) / width)}
      aria-hidden="true"
      focusable="false"
      className={`mascot ${interactive ? "" : "mascot-still"} ${className}`}
      data-mood={mood}
      data-patted={patted || undefined}
    >
      <Puppy mood={patted ? "happy" : mood} pupilsRef={pupilsRef} leash={framing === "full"} />
      {patted && (
        <path
          key={pats}
          className="mascot-heart"
          d="M146 48c-4-8-16-6-16 3 0 7 9 12 16 18 7-6 16-11 16-18 0-9-12-11-16-3z"
          fill="#ff6b81"
        />
      )}
    </svg>
  );

  if (!interactive) return picture;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPats((count) => count + 1);
          setPatted(true);
        }}
        className="block rounded-[inherit]"
      >
        <span className="sr-only">Pat {MASCOT_NAME}</span>
        {picture}
      </button>
      <span role="status" className="sr-only">
        {patted ? `${MASCOT_NAME} wags its tail.` : ""}
      </span>
    </>
  );
}

const INK = "#3a2a22";
const FUR_DARK = "#d9934a";
const CHEEK = "#f4a3a3";
const TONGUE = "#ef7d8c";

/** Gradient ids, unique per drawing: one page can show Rex twice. */
type Paint = { fur: string; ear: string; snout: string };

function Puppy({
  mood,
  pupilsRef,
  leash,
}: {
  mood: MascotMood;
  pupilsRef: Ref<SVGGElement>;
  leash: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const paint: Paint = { fur: `url(#${id}-fur)`, ear: `url(#${id}-ear)`, snout: `url(#${id}-snout)` };
  const held = mood === "stopped";
  const perked = mood === "listening";
  const headTilt =
    mood === "waiting"
      ? "rotate(-10 95 112)"
      : perked
        ? "rotate(7 95 112)"
        : held
          ? "rotate(-4 95 112)"
          : undefined;
  // Ears: up while listening, down when the leash holds Rex back.
  const earTurn = held ? 14 : perked ? -12 : 0;

  return (
    <>
      <defs>
        <radialGradient id={`${id}-fur`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fcdcaa" />
          <stop offset="1" stopColor="#eeae63" />
        </radialGradient>
        <linearGradient id={`${id}-ear`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b97b4a" />
          <stop offset="1" stopColor="#8a5330" />
        </linearGradient>
        <radialGradient id={`${id}-snout`} cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fffbf4" />
          <stop offset="1" stopColor="#fbe3c4" />
        </radialGradient>
      </defs>

      <ellipse cx="95" cy="190" rx="50" ry="5" fill="#000" opacity="0.08" />

      {/* The lean is an attribute; the animation moves the inner group. */}
      <g transform={held ? "translate(-6 0) rotate(-5 95 186)" : undefined}>
        {/* The leash: slack on the ground while Rex may go on, pulled taut
            from outside the picture when Leash holds Rex back. */}
        {leash &&
          (held ? (
            <path d="M98 134 L220 56" fill="none" stroke="var(--leash-color)" strokeWidth="4" strokeLinecap="round" />
          ) : (
            <g fill="none" stroke="var(--leash-color)" strokeWidth="4" strokeLinecap="round">
              <path d="M98 135 C108 162 128 186 156 186 C168 186 176 184 182 181" />
              <ellipse cx="192" cy="178" rx="11" ry="6" />
            </g>
          ))}

        <g className="mascot-all">
          <path
            className="mascot-tail"
            d={held ? "M126 166 C140 176 148 180 158 182" : "M126 160 C148 152 158 136 154 120"}
            fill="none"
            stroke={FUR_DARK}
            strokeWidth="11"
            strokeLinecap="round"
          />

          <g className="mascot-body">
            <path d="M58 160 C58 130 76 118 95 118 C114 118 132 130 132 160 C132 178 118 188 95 188 C72 188 58 178 58 160Z" fill={paint.fur} />
            <ellipse cx="95" cy="162" rx="22" ry="21" fill={paint.snout} />
            <ellipse cx="78" cy="185" rx="12" ry="6.5" fill={paint.snout} />
            <ellipse cx="112" cy="185" rx="12" ry="6.5" fill={paint.snout} />
          </g>

          <g transform={headTilt}>
            <g className="mascot-head">
              <path
                d="M64 54 C42 50 30 78 35 104 C38 120 56 120 61 104 C66 88 72 64 64 54Z"
                fill={paint.ear}
                transform={`rotate(${earTurn} 64 56)`}
              />
              <path
                d="M126 54 C148 50 160 78 155 104 C152 120 134 120 129 104 C124 88 118 64 126 54Z"
                fill={paint.ear}
                transform={`rotate(${-earTurn} 126 56)`}
              />
              <ellipse cx="95" cy="86" rx="47" ry="42" fill={paint.fur} />
              <ellipse cx="95" cy="50" rx="12" ry="7" fill={FUR_DARK} opacity="0.35" />

              <Brows mood={mood} />
              <Eyes mood={mood} pupilsRef={pupilsRef} />

              <ellipse cx="65" cy="100" rx="8" ry="5" fill={CHEEK} opacity="0.55" />
              <ellipse cx="125" cy="100" rx="8" ry="5" fill={CHEEK} opacity="0.55" />

              <g className="mascot-snout">
                <ellipse cx="95" cy="104" rx="21" ry="15" fill={paint.snout} />
                <path d="M87 95 Q95 90 103 95 Q101 103 95 103 Q89 103 87 95 Z" fill={INK} />
                <ellipse cx="92" cy="94.5" rx="3" ry="1.6" fill="#fff" opacity="0.6" />
                <Mouth mood={mood} />
              </g>
            </g>
          </g>

          <path d="M66 121 Q95 136 124 121" fill="none" stroke="var(--leash-color)" strokeWidth="8" strokeLinecap="round" />
          <circle cx="97" cy="133" r="5" fill="#fbbf24" stroke={INK} strokeOpacity="0.25" />

          {mood === "working" && <Laptop />}
        </g>
      </g>

      {mood === "waiting" && (
        <text x="144" y="60" fontSize="28" fontWeight="700" fill="currentColor" opacity="0.7">
          ?
        </text>
      )}
    </>
  );
}

/** A tiny laptop seen from behind, with Rex's paws tapping the keys. */
function Laptop() {
  return (
    <g>
      <rect x="61" y="134" width="68" height="42" rx="8" fill="#e5e5ea" stroke="#c7c7cc" strokeWidth="1.5" />
      <circle cx="95" cy="155" r="4.5" fill="var(--leash-color)" />
      <rect x="53" y="173" width="84" height="7" rx="3.5" fill="#c7c7cc" />
      <ellipse className="mascot-tap" cx="71" cy="172" rx="10" ry="6" fill="#fbe3c4" />
      <ellipse className="mascot-tap mascot-tap-late" cx="119" cy="172" rx="10" ry="6" fill="#fbe3c4" />
    </g>
  );
}

/** Eyebrows carry most of the feeling: focused, worried, raised. */
function Brows({ mood }: { mood: MascotMood }) {
  const [left, right] =
    mood === "working"
      ? ["M70 66 L84 69", "M106 69 L120 66"]
      : mood === "waiting" || mood === "stopped"
        ? ["M70 68 L84 64", "M106 64 L120 68"]
        : mood === "listening" || mood === "happy"
          ? ["M70 63 Q77 59 84 62", "M106 62 Q113 59 120 63"]
          : ["M70 66 Q77 63 84 65", "M106 65 Q113 63 120 66"];
  return (
    <g fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round">
      <path d={left} />
      <path d={right} />
    </g>
  );
}

function Eyes({ mood, pupilsRef }: { mood: MascotMood; pupilsRef: Ref<SVGGElement> }) {
  if (mood === "happy") {
    return (
      <g fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round">
        <path d="M70 84 Q77 75 84 84" />
        <path d="M106 84 Q113 75 120 84" />
      </g>
    );
  }
  if (mood === "stopped") {
    return (
      <g fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round">
        <path d="M70 82 Q77 86 84 82" />
        <path d="M106 82 Q113 86 120 82" />
      </g>
    );
  }
  // Round, shiny eyes, looking down at the keys or at the message while busy.
  const down = mood === "working" ? "translate(0 4)" : mood === "listening" ? "translate(1 3)" : undefined;
  return (
    <g className="mascot-eyes">
      <g ref={pupilsRef} transform={down}>
        <circle cx="77" cy="81" r="8" fill={INK} />
        <circle cx="113" cy="81" r="8" fill={INK} />
        <circle cx="80" cy="77.5" r="3" fill="#fff" />
        <circle cx="116" cy="77.5" r="3" fill="#fff" />
        <circle cx="74.5" cy="84.5" r="1.3" fill="#fff" opacity="0.8" />
        <circle cx="110.5" cy="84.5" r="1.3" fill="#fff" opacity="0.8" />
      </g>
    </g>
  );
}

function Mouth({ mood }: { mood: MascotMood }) {
  if (mood === "happy") {
    return (
      <>
        <path d="M86 108 Q95 122 104 108 Z" fill={INK} />
        <ellipse cx="95" cy="115" rx="5" ry="4" fill={TONGUE} />
      </>
    );
  }
  const d =
    mood === "stopped"
      ? "M88 112 Q95 106 102 112"
      : mood === "working"
        ? "M91 109 Q95 111 99 109"
        : "M87 108 Q95 114 103 108";
  return <path d={d} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
}
