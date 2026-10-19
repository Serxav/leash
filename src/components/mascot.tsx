"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { MASCOT_NAME, type MascotMood } from "./mascot-mood";

/**
 * Rex, the shopping agent's mascot (D-042): a puppy on a leash, drawn for
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

  const [x, y, width, height] = framing === "tile" ? [22, 14, 170, 184] : [0, 0, 220, 200];
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
      <Puppy mood={patted ? "happy" : mood} pupilsRef={pupilsRef} />
      {patted && (
        <path
          key={pats}
          className="mascot-heart"
          d="M160 44c-4-8-16-6-16 3 0 7 9 12 16 18 7-6 16-11 16-18 0-9-12-11-16-3z"
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
const FUR = "#f3c07b";
const FUR_DARK = "#d9934a";
const EAR = "#a86a3d";
const SNOUT = "#fff1dc";
const CHEEK = "#f4a3a3";
const TONGUE = "#ef7d8c";

function Puppy({ mood, pupilsRef }: { mood: MascotMood; pupilsRef: Ref<SVGGElement> }) {
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
  const earY = held ? 92 : perked ? 70 : 80;
  const earTurn = held ? 32 : perked ? 8 : 20;

  return (
    <>
      <ellipse cx="95" cy="190" rx="52" ry="6" fill="#000" opacity="0.08" />

      {/* The lean is an attribute; the animation moves the inner group. */}
      <g transform={held ? "translate(-6 0) rotate(-5 95 186)" : undefined}>
        {/* The leash: slack while Rex may go on, taut when Leash holds it back. */}
        <path
          d={held ? "M100 128 L218 30" : "M100 128 C150 160 186 34 218 30"}
          fill="none"
          stroke="var(--leash-color)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="208" y="22" width="12" height="18" rx="4" fill="var(--leash-color)" />

        <g className="mascot-all">
          <path
            className="mascot-tail"
            d={held ? "M128 166 C142 176 150 180 160 182" : "M128 160 C150 152 160 136 156 120"}
            fill="none"
            stroke={FUR_DARK}
            strokeWidth="11"
            strokeLinecap="round"
          />

          <g className="mascot-body">
            <ellipse cx="95" cy="152" rx="42" ry="36" fill={FUR} />
            <ellipse cx="95" cy="160" rx="24" ry="22" fill={SNOUT} />
            <ellipse cx="77" cy="185" rx="13" ry="7" fill={FUR_DARK} />
            <ellipse cx="113" cy="185" rx="13" ry="7" fill={FUR_DARK} />
          </g>

          <g transform={headTilt}>
            <g className="mascot-head">
              <ellipse cx="55" cy={earY} rx="15" ry="28" fill={EAR} transform={`rotate(${earTurn} 55 ${earY})`} />
              <ellipse cx="135" cy={earY} rx="15" ry="28" fill={EAR} transform={`rotate(${-earTurn} 135 ${earY})`} />
              <circle cx="95" cy="84" r="44" fill={FUR} />
              <ellipse cx="114" cy="60" rx="13" ry="10" fill={FUR_DARK} opacity="0.55" />

              <Eyes mood={mood} pupilsRef={pupilsRef} />

              <circle cx="66" cy="98" r="7" fill={CHEEK} opacity="0.7" />
              <circle cx="124" cy="98" r="7" fill={CHEEK} opacity="0.7" />

              <g className="mascot-snout">
                <ellipse cx="95" cy="102" rx="20" ry="14" fill={SNOUT} />
                <path d="M88 94 Q95 89 102 94 Q99 101 95 101 Q91 101 88 94 Z" fill={INK} />
                <Mouth mood={mood} />
              </g>
            </g>
          </g>

          <rect x="67" y="119" width="56" height="9" rx="4.5" fill="var(--leash-color)" />
          <circle cx="100" cy="131" r="5" fill="#fbbf24" stroke={INK} strokeOpacity="0.3" />

          {mood === "working" && <Laptop />}
        </g>
      </g>

      {mood === "waiting" && (
        <text x="150" y="50" fontSize="30" fontWeight="700" fill="currentColor" opacity="0.7">
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
      <rect x="60" y="132" width="70" height="42" rx="7" fill="#d1d1d6" stroke="#aeaeb2" strokeWidth="1.5" />
      <circle cx="95" cy="152" r="5" fill="var(--leash-color)" />
      <rect x="52" y="172" width="86" height="8" rx="4" fill="#aeaeb2" />
      <ellipse className="mascot-tap" cx="70" cy="172" rx="10" ry="6" fill={FUR_DARK} />
      <ellipse className="mascot-tap mascot-tap-late" cx="120" cy="172" rx="10" ry="6" fill={FUR_DARK} />
    </g>
  );
}

function Eyes({ mood, pupilsRef }: { mood: MascotMood; pupilsRef: Ref<SVGGElement> }) {
  if (mood === "happy") {
    return (
      <g fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round">
        <path d="M70 84 Q78 74 86 84" />
        <path d="M104 84 Q112 74 120 84" />
      </g>
    );
  }
  if (mood === "stopped") {
    return (
      <g fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round">
        <path d="M70 80 L86 84" />
        <path d="M104 84 L120 80" />
      </g>
    );
  }
  // Round eyes, looking down at the keys or at the message while busy.
  const down = mood === "working" ? "translate(0 4)" : mood === "listening" ? "translate(1 3)" : undefined;
  return (
    <g className="mascot-eyes">
      <g ref={pupilsRef} transform={down}>
        <circle cx="78" cy="80" r="7" fill={INK} />
        <circle cx="112" cy="80" r="7" fill={INK} />
        <circle cx="80.5" cy="77.5" r="2.2" fill="#fff" />
        <circle cx="114.5" cy="77.5" r="2.2" fill="#fff" />
      </g>
    </g>
  );
}

function Mouth({ mood }: { mood: MascotMood }) {
  if (mood === "happy") {
    return (
      <>
        <path d="M85 106 Q95 120 105 106 Z" fill={INK} />
        <ellipse cx="95" cy="113" rx="5" ry="4" fill={TONGUE} />
      </>
    );
  }
  const d =
    mood === "stopped"
      ? "M87 110 Q95 104 103 110"
      : mood === "working"
        ? "M91 107 Q95 109 99 107"
        : "M87 106 Q95 112 103 106";
  return <path d={d} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
}
