export const INBOX_PATH = "/inbox";

/** What the inbox shows after the user answers. Only text for the UI. */
export type InboxFormState =
  | { kind: "idle" }
  | { kind: "answered"; ok: boolean; message: string };
