import { afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/v1/[...path]/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("preserves server-side app authentication and Trusted Sources OIDC without returning credentials", async () => {
  vi.stubEnv("API_BASE_URL", "https://qa-backend.vercel.app");
  vi.stubEnv("API_TOKEN", "unit-app-token");
  vi.stubEnv("HF_TOKEN", "unit-hf-secret");
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(
    new NextRequest("https://qa-frontend.vercel.app/api/v1/health", {
      headers: { "x-vercel-oidc-token": "unit-identity" },
    }),
    { params: Promise.resolve({ path: ["health"] }) },
  );
  const options = (
    fetcher.mock.calls as unknown as [string, RequestInit][]
  )[0][1];
  expect(options.headers).toMatchObject({
    Authorization: "Bearer unit-app-token",
    "x-vercel-trusted-oidc-idp-token": "unit-identity",
  });
  expect(JSON.stringify(options)).not.toContain("unit-hf-secret");
  expect(await response.text()).not.toContain("unit-identity");
  expect(response.headers.has("x-vercel-trusted-oidc-idp-token")).toBe(false);
});
it("does not forward platform identity to a non-Vercel origin", async () => {
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:8000");
  const fetcher = vi.fn(
    async () =>
      new Response("{}", { headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetcher);
  await GET(
    new NextRequest("https://frontend.example/api/v1/health", {
      headers: { "x-vercel-oidc-token": "unit-identity" },
    }),
    { params: Promise.resolve({ path: ["health"] }) },
  );
  const options = (
    fetcher.mock.calls as unknown as [string, RequestInit][]
  )[0][1];
  expect(options.headers).not.toHaveProperty("x-vercel-trusted-oidc-idp-token");
});
