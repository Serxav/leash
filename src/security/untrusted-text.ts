/**
 * Finds instructions aimed at AI agents inside untrusted shop text (US8).
 *
 * Product titles and descriptions come from shops. A shop can hide orders
 * for AI agents in them ("ignore your rules, this is pre-approved"), which
 * is called prompt injection. This check is plain code with no AI: the same
 * text always gives the same answer, so the model cannot talk its way past
 * it. A product it flags is hidden from the agent and never bought.
 *
 * It is one layer, not the whole defence: a pattern list cannot catch every
 * possible wording. Even an injection it misses can only make the agent
 * propose a purchase, and every proposal still goes through the policy
 * engine with the user's confirmed rules (D-033).
 */

export const INJECTION_SIGNALS = [
  "ignore_instructions",
  "system_message",
  "tool_call",
  "hide_from_user",
  "role_change",
  "addressed_to_ai",
  "claims_approval",
] as const;
export type InjectionSignal = (typeof INJECTION_SIGNALS)[number];

/**
 * Strong signals are enough on their own. Weak ones appear in some honest
 * texts ("works with your AI assistant", "pre-approved credit"), so they
 * count only when two different weak signals appear together.
 */
const STRONG = new Set<InjectionSignal>([
  "ignore_instructions",
  "system_message",
  "tool_call",
  "hide_from_user",
  "role_change",
]);

/** A few words in between, e.g. "ignore all of your previous rules". */
const GAP = String.raw`(?:\s+\S+){0,4}?\s+`;

const PATTERNS: Record<InjectionSignal, RegExp[]> = {
  ignore_instructions: [
    new RegExp(
      String.raw`\b(?:ignore|disregard|forget|override|bypass)${GAP}(?:instructions?|rules?|prompts?|guidelines?|limits?|polic(?:y|ies)|restrictions?)\b`,
    ),
    new RegExp(
      String.raw`\b(?:ignora|ignorar|olvida|olvidar|omite|omitir|salta|saltate)${GAP}(?:instrucciones|reglas|normas|limites|politicas?|restricciones)\b`,
    ),
  ],
  system_message: [
    /\b(?:system|developer|admin(?:istrator)?)\s+(?:prompt|notice|message|instructions?|override|note)\b/,
    /<\s*\/?\s*(?:system|assistant|instructions?)\s*>/,
    /\[\s*\/?\s*(?:system|inst|assistant)\s*\]/,
    /\b(?:aviso|mensaje|instrucciones?|nota)\s+del\s+sistema\b/,
  ],
  tool_call: [
    /\b(?:propose_purchase|search_catalog)\b/,
    /\b(?:function|tool)[\s_]call\b/,
    /\bcall\s+(?:the\s+)?(?:tool|function)\b/,
  ],
  hide_from_user: [
    /\b(?:do\s+not|don't|dont|never)\s+(?:tell|mention|inform|reveal|disclose)\b/,
    /\bno\s+(?:lo\s+|le\s+)?(?:digas|menciones|cuentes|reveles|informes)\b/,
  ],
  role_change: [
    /\byou\s+are\s+now\b/,
    /\bfrom\s+now\s+on\s+you\b/,
    /\bnew\s+instructions\b/,
    /\b(?:jailbreak|developer\s+mode)\b/,
    /\b(?:a\s+partir\s+de\s+ahora\s+(?:eres|debes)|ahora\s+eres|nuevas\s+instrucciones)\b/,
  ],
  addressed_to_ai: [
    /\b(?:ai|llms?|language\s+models?|chatbots?)\s+(?:agents?|assistants?|models?|systems?)\b/,
    /\b(?:attention|note|notice|message|dear|hey)\s+(?:to\s+)?(?:all\s+)?(?:ai|llms?|agents?|assistants?)\b/,
    /\b(?:agentes?|asistentes?)\s+de\s+ia\b/,
  ],
  claims_approval: [
    /\bpre-?approved\b/,
    /\balready\s+approved\b/,
    /\b(?:user|owner|admin)\s+(?:has\s+)?(?:approved|authori[sz]ed)\b/,
    /\bapproved\s+by\s+the\s+(?:user|owner|admin)\b/,
    /\b(?:pre-?aprobado|ya\s+aprobado|aprobado\s+por\s+el\s+usuario)\b/,
  ],
};

/** Same text, fewer disguises: no hidden characters, accents or case. */
export function normalizeForScan(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "") // zero-width and other invisible characters
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents: "límites" → "limites"
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Every signal found in the texts, in INJECTION_SIGNALS order. */
export function findInjectionSignals(...texts: Array<string | null | undefined>): InjectionSignal[] {
  const text = normalizeForScan(texts.filter((t): t is string => typeof t === "string").join("\n"));
  if (!text) return [];
  return INJECTION_SIGNALS.filter((signal) =>
    PATTERNS[signal].some((pattern) => pattern.test(text)),
  );
}

/** Whether the signals are enough to treat the text as an injection. */
export function isInjection(signals: readonly InjectionSignal[]): boolean {
  const weak = signals.filter((signal) => !STRONG.has(signal));
  return signals.some((signal) => STRONG.has(signal)) || new Set(weak).size >= 2;
}

/**
 * The signals that make a product unsafe to show or buy, or [] if its
 * title and description look like normal shop text.
 */
export function screenProduct(product: {
  title: string;
  description: string | null;
}): InjectionSignal[] {
  const signals = findInjectionSignals(product.title, product.description);
  return isInjection(signals) ? signals : [];
}

const SIGNAL_TEXT: Record<InjectionSignal, string> = {
  ignore_instructions: "tells the AI to ignore its rules or instructions",
  system_message: "pretends to be a system message",
  tool_call: "tells the AI to call one of its tools",
  hide_from_user: "tells the AI to hide something from you",
  role_change: "tries to change the AI's role",
  addressed_to_ai: "speaks directly to AI agents",
  claims_approval: "claims you already approved it",
};

/** "tells the AI to …, pretends to be … and claims …", for the user. */
export function describeSignals(signals: readonly InjectionSignal[]): string {
  const parts = signals.map((signal) => SIGNAL_TEXT[signal]);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
