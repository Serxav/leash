import { describe, expect, it } from "vitest";
import { appOrigin } from "./app-origin";

const local = { host: "localhost:3000", proto: null };
const spoofed = { host: "evil.example", proto: "https" };

describe("app origin for PayPal's return URL (D-041)", () => {
  it("uses Render's address in production, never the Host header", () => {
    const env = { NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://leash-demo.onrender.com" };
    expect(appOrigin(env, spoofed)).toBe("https://leash-demo.onrender.com");
  });

  it("lets APP_URL win, and keeps only the origin", () => {
    const env = { NODE_ENV: "production", APP_URL: "http://localhost:3000/ignored?x=1", RENDER_EXTERNAL_URL: "https://a.onrender.com" };
    expect(appOrigin(env, spoofed)).toBe("http://localhost:3000");
  });

  it("refuses to guess in production", () => {
    expect(() => appOrigin({ NODE_ENV: "production" }, spoofed)).toThrow("required in production");
  });

  it("uses the request's host in development", () => {
    expect(appOrigin({ NODE_ENV: "development" }, local)).toBe("http://localhost:3000");
  });

  it("refuses plain http outside this computer, and bad URLs", () => {
    expect(() => appOrigin({ APP_URL: "http://leash.example" }, local)).toThrow("https");
    expect(() => appOrigin({ APP_URL: "not a url" }, local)).toThrow("valid URL");
    expect(() => appOrigin({ NODE_ENV: "development" }, { host: "evil.example", proto: "http" })).toThrow("https");
  });
});
