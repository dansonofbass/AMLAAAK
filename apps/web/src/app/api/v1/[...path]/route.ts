import { NextRequest, NextResponse } from "next/server";
const allowed = new Set([
  "health",
  "model/status",
  "dashboard/summary",
  "analytics/cities",
  "analytics/distributions",
  "properties",
  "model/metrics",
  "predict",
]);
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/");
  if (!allowed.has(route) && !/^properties\/[a-f0-9]{16}$/.test(route))
    return NextResponse.json(
      { error: { code: "not_found", message: "Unknown API route" } },
      { status: 404 },
    );
  if (request.method === "POST" && route !== "predict")
    return NextResponse.json(
      { error: { code: "method_not_allowed", message: "Method not allowed" } },
      { status: 405 },
    );
  if (request.method === "GET" && route === "predict")
    return NextResponse.json(
      {
        error: {
          code: "method_not_allowed",
          message: "Use POST for predictions",
        },
      },
      { status: 405 },
    );
  const origin = process.env.API_BASE_URL;
  if (!origin)
    return NextResponse.json(
      {
        error: {
          code: "not_configured",
          message:
            "Backend is not configured. Set API_BASE_URL on the web server.",
        },
      },
      { status: 503 },
    );
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 8192)
      return NextResponse.json(
        { error: { code: "too_large", message: "Request body too large" } },
        { status: 413 },
      );
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.API_TOKEN)
      headers.Authorization = `Bearer ${process.env.API_TOKEN}`;
    const response = await fetch(
      `${origin.replace(/\/$/, "")}/api/v1/${route}${request.nextUrl.search}`,
      {
        method: request.method,
        body,
        headers,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("Backend did not return JSON");
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "backend_unreachable",
          message:
            "Cannot reach the analytics backend. Check its health and server configuration.",
        },
      },
      { status: 502 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
