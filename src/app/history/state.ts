export const HISTORY_PATH = "/history";

/** What the history page shows after a refund. Only text for the UI. */
export type HistoryFormState =
  | { kind: "idle" }
  | { kind: "answered"; ok: boolean; message: string };
