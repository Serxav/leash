export const PERMISSIONS_PATH = "/permissions";

/** What the permissions page shows after an action. Only text for the UI. */
export type PermissionsFormState =
  | { kind: "idle" }
  | { kind: "answered"; ok: boolean; message: string };
