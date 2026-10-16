/**
 * Limits shared by the server and the rules form. Kept apart from
 * builder.ts so browser code never bundles the AI prompt or SDK.
 */
export const MAX_RULES_TEXT_LENGTH = 1000;
