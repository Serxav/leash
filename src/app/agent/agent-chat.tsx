"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { AgentText } from "@/components/agent-text";
import { Mascot } from "@/components/mascot";
import {
  MASCOT_NAME,
  moodForOutcomes,
  MOOD_STATUS,
  outcomeSummary,
  WORK_STEPS,
  type MascotMood,
  type RestingMood,
} from "@/components/mascot-mood";
import { ProposalCard } from "@/components/proposal-card";
import { SubmitButton } from "@/components/submit-button";
import { runAgent } from "./actions";
import type { Outcome } from "@/rules/engine";
import type { AgentReply } from "./state";

/** Keep in sync with MAX_REQUEST_LENGTH in src/agent/agent.ts. */
const MAX_REQUEST_LENGTH = 500;

/** Marta's usual requests: supplies, a toner that waits for her, a chair above her limits. */
const SUGGESTIONS = [
  "We are out of printer paper and sticky notes, restock for the month.",
  "Our laser printer needs a new black toner cartridge.",
  "Get an ergonomic office chair for the new hire.",
];

/** How long each work step shows in the status while the agent runs. */
const STEP_MS = 3500;
/** Rex stops "listening" this long after the last key. */
const TYPING_MS = 1500;

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

type ChatTurn = { id: number; request: string; sentAt: Date; reply: AgentReply };

/**
 * Chat with Rex, the shopping agent (US3, D-042), laid out like Muse: Rex
 * small at the top with a live status, one message thread, permission
 * cards for the proposals and a floating message box. Each message runs
 * the agent once. The chat lives in this page only; the proposals
 * themselves are stored and listed under "Rules & activity".
 */
export function AgentChat({ activity, notices }: { activity: ReactNode; notices: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const headerRef = useRef<HTMLElement>(null);
  const [typing, setTyping] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [sending, setSending] = useState({ text: "", at: new Date(0) });
  const [now, setNow] = useState(0);
  // The user's answers on the chat's cards, so Rex stops waiting for them.
  const [answers, setAnswers] = useState<Record<string, Outcome>>({});
  const [turns, send, pending] = useActionState(async (previous: ChatTurn[], formData: FormData) => {
    const raw = formData.get("request");
    const request = (typeof raw === "string" ? raw : "").trim().slice(0, MAX_REQUEST_LENGTH);
    const sentAt = new Date();
    let reply: AgentReply;
    try {
      reply = await runAgent(formData);
    } catch {
      reply = { kind: "error", message: "Leash could not be reached. Please try again.", proposals: [], mood: "idle" };
    }
    return [...previous, { id: previous.length, request, sentAt, reply }];
  }, []);

  // While the agent works, the status walks through its steps.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [pending]);
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // Rex scrolls away with the top of the chat; while it works, a small
  // copy floats at the top so the user always knows (D-042).
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new IntersectionObserver(([entry]) => setHeaderVisible(entry.isIntersecting));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Like any chat, show the newest message.
  useEffect(() => {
    if (turns.length === 0 && !pending) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, [turns.length, pending]);

  const last = turns.at(-1)?.reply;
  const lastOutcomes = (last?.proposals ?? []).map((card) => answers[card.intentId] ?? card.outcome);
  const lastMood = last && Object.keys(answers).length > 0 ? moodForOutcomes(lastOutcomes) : last?.mood;
  const restingMood: RestingMood = typing ? "listening" : (lastMood ?? "idle");
  const mood: MascotMood = pending ? "working" : restingMood;
  const step =
    WORK_STEPS[Math.min(Math.max(0, Math.floor((now - sending.at.getTime()) / STEP_MS)), WORK_STEPS.length - 1)];
  const summary = !typing && last ? outcomeSummary(lastOutcomes) : null;
  // Quiet when nothing happens: then it only says Rex is an AI agent.
  const status = pending
    ? step.dog
    : restingMood === "idle" && !summary
      ? "AI shopping agent"
      : `${MOOD_STATUS[restingMood]}${summary ? ` · ${summary}` : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
      <header ref={headerRef} className="relative z-30 grid grid-cols-[1fr_auto_1fr] items-start pt-4 pb-4">
        <details className="relative justify-self-start">
          <summary className="card btn cursor-pointer list-none px-3.5 text-sm [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Rules &amp; activity</span>
            <span className="sm:hidden">Rules</span>
          </summary>
          <div className="glass rise-in absolute top-12 left-0 z-30 flex max-h-[calc(100dvh-12rem)] w-[min(24rem,calc(100vw-2rem))] flex-col gap-5 overflow-y-auto rounded-3xl p-4">
            {activity}
          </div>
        </details>

        {/* Like Muse: a small avatar tile and the name; one quiet line under it. */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="card rounded-[16px] p-1">
            <Mascot mood={mood} framing="tile" size={40} interactive />
          </div>
          <p className="text-xs font-semibold">{MASCOT_NAME}</p>
          <p key={status} className="rise-in max-w-52 text-[11px] leading-4 text-muted">
            {status}
          </p>
        </div>
      </header>

      {pending && !headerVisible && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center md:left-20">
          <div className="glass rise-in flex items-center gap-2 rounded-full py-1 pr-4 pl-1.5">
            <Mascot mood="working" framing="tile" size={30} />
            <span className="text-xs">
              <span className="font-semibold">{MASCOT_NAME}</span>{" "}
              <span key={step.dog} className="rise-in inline-block text-muted">
                {step.dog}
              </span>
            </span>
          </div>
        </div>
      )}

      <h1 className="sr-only">Chat with {MASCOT_NAME}, the shopping agent</h1>

      <div role="log" aria-label={`Chat with ${MASCOT_NAME}`} className="flex flex-col gap-3 pt-2 pb-48">
        {notices}
        {turns.length === 0 && !pending && (
          <AgentBubble>
            <p>
              Hi! I&apos;m {MASCOT_NAME}, an AI shopping agent. Tell me what the office needs and
              I&apos;ll look for it in the shops. I can only <em>propose</em>: Leash&apos;s code
              checks every purchase against your rules before PayPal (sandbox) charges anything.
            </p>
          </AgentBubble>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-3">
            <Timestamp at={turn.sentAt} />
            <UserBubble text={turn.request} />
            <AgentBubble error={turn.reply.kind === "error"}>
              {turn.reply.kind === "done" ? <AgentText text={turn.reply.summary} /> : <p>{turn.reply.message}</p>}
            </AgentBubble>
            {turn.reply.proposals.length > 0 && (
              <ul aria-label="Proposals in this answer" className="flex max-w-xl flex-col gap-3">
                {turn.reply.proposals.map((card) => (
                  <li key={card.intentId}>
                    <ProposalCard
                      card={card}
                      onAnswered={(approved) =>
                        setAnswers((all) => ({ ...all, [card.intentId]: approved ? "APPROVE" : "BLOCK" }))
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {pending && (
          <div className="flex flex-col gap-3">
            <Timestamp at={sending.at} />
            <UserBubble text={sending.text} arriving />
            <AgentBubble>
              <span className="sr-only">{MASCOT_NAME} is working. This can take up to a minute.</span>
              {/* What the agent is doing now; not announced at every change. */}
              <span aria-hidden="true" className="flex items-center gap-2.5">
                <span className="flex items-center gap-1">
                  <span className="typing-dot size-1.5 rounded-full bg-current" />
                  <span className="typing-dot size-1.5 rounded-full bg-current" />
                  <span className="typing-dot size-1.5 rounded-full bg-current" />
                </span>
                <span key={step.agent} className="rise-in text-muted">
                  {step.agent}
                </span>
              </span>
            </AgentBubble>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[5.5rem] z-20 px-4 md:bottom-4 md:left-20">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {turns.length === 0 && !pending && (
            <ul aria-label="Try one of these" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!inputRef.current) return;
                      inputRef.current.value = suggestion;
                      setHasText(true);
                      inputRef.current.focus();
                    }}
                    className="glass rounded-full px-3.5 py-2 text-left text-xs whitespace-nowrap transition-transform active:scale-95"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            ref={formRef}
            action={send}
            onSubmit={() => {
              clearTimeout(typingTimer.current);
              setTyping(false);
              setHasText(false);
              const at = new Date();
              setNow(at.getTime());
              setSending({ text: inputRef.current?.value.trim() ?? "", at });
              // Empty the box once the form data is read, as chats do.
              setTimeout(() => {
                if (inputRef.current) inputRef.current.value = "";
              }, 0);
            }}
            className="flex items-end gap-2 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-1.5 pl-4 shadow-[var(--shadow)] has-[textarea:focus-visible]:border-[var(--accent)]"
          >
            <label htmlFor="agent-request" className="sr-only">
              Message to {MASCOT_NAME}
            </label>
            <textarea
              ref={inputRef}
              id="agent-request"
              name="request"
              required
              rows={1}
              maxLength={MAX_REQUEST_LENGTH}
              aria-describedby="agent-request-hint"
              placeholder={`Message ${MASCOT_NAME}`}
              onInput={(event) => {
                // Rex perks up while the user types.
                const written = event.currentTarget.value.trim() !== "";
                setHasText(written);
                setTyping(written);
                clearTimeout(typingTimer.current);
                if (written) typingTimer.current = setTimeout(() => setTyping(false), TYPING_MS);
              }}
              onKeyDown={(event) => {
                // Enter sends, like other chats; Shift+Enter adds a line.
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (!pending) formRef.current?.requestSubmit();
              }}
              className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1 text-base leading-6 outline-none [field-sizing:content] placeholder:text-muted sm:text-sm"
            />
            <SubmitButton
              pending={pending}
              aria-label={pending ? `${MASCOT_NAME} is working` : `Send to ${MASCOT_NAME}`}
              className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
                hasText || pending ? "bg-[var(--accent-fill)] text-white" : "bg-[var(--surface-muted)] text-muted"
              }`}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M10 16V4m0 0-5 5m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </SubmitButton>
          </form>
          <p id="agent-request-hint" className="sr-only">
            Enter sends, Shift+Enter adds a line.
          </p>
        </div>
      </div>
    </div>
  );
}

function Timestamp({ at }: { at: Date }) {
  return <p className="pt-2 text-center text-[11px] text-muted">{clock.format(at)}</p>;
}

/** "arriving" animates the bubble in once, when it is sent. */
function UserBubble({ text, arriving = false }: { text: string; arriving?: boolean }) {
  return (
    <div className={`flex justify-end ${arriving ? "rise-in" : ""}`}>
      <p className="max-w-[80%] rounded-[20px] bg-[var(--bubble-user)] px-4 py-2.5 text-[15px] leading-6 whitespace-pre-line">
        <span className="sr-only">You: </span>
        {text}
      </p>
    </div>
  );
}

function AgentBubble({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return (
    <div className="rise-in flex">
      <div
        className={`max-w-[85%] rounded-[20px] px-4 py-2.5 text-[15px] leading-6 ${
          error ? "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-[var(--bubble-agent)]"
        }`}
      >
        <span className="sr-only">{MASCOT_NAME}: </span>
        {children}
      </div>
    </div>
  );
}
