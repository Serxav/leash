// Test stand-in for the "server-only" package. In Next.js, importing a
// server-only module from browser code fails the build; Vitest runs as
// server code, so the import is simply allowed here.
export {};
