import type { ProposalView } from "@/purchases/propose";

/** Where a proposed product came from (D-035). */
export const SOURCE_LABELS: Record<ProposalView["source"], string> = {
  channel3: "Channel3 offer",
  local: "Demo shop",
};
