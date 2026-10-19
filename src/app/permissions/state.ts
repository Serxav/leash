export const PERMISSIONS_PATH = "/permissions";
/** Where PayPal sends the payer back after saving PayPal (return and cancel). */
export const PAYPAL_PATH = "/permissions/paypal";

/** What the permissions page shows after an action. Only text for the UI. */
export type PermissionsFormState =
  | { kind: "idle" }
  | { kind: "answered"; ok: boolean; message: string };
