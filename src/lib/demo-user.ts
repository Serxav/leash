/**
 * The single demo user from before F5. The app now gives every visitor an
 * anonymous user of their own (`src/account/visitor.ts`, D-040); this ID is
 * kept only for the local sandbox tests (`npm run test:sandbox`), which use
 * the PayPal mandate saved for it in the local database.
 */
export const DEMO_USER_ID = "demo-user";
