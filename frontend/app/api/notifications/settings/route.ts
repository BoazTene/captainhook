import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://localhost:8000";

function getBackendBaseUrl(): string {
  return process.env.BACKEND_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BACKEND_URL;
}

export async function GET() {
  const backendBaseUrl = getBackendBaseUrl();
  const upstreamUrl = new URL("/api/v1/notifications/settings", backendBaseUrl);

  const upstreamResponse = await fetch(upstreamUrl.toString(), { cache: "no-store" });
  const payload = await upstreamResponse.text();

  return new NextResponse(payload, {
    status: upstreamResponse.status,
    headers: { "content-type": upstreamResponse.headers.get("content-type") ?? "application/json" },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.text();
  const backendBaseUrl = getBackendBaseUrl();
  const upstreamUrl = new URL("/api/v1/notifications/settings", backendBaseUrl);

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  const payload = await upstreamResponse.text();

  return new NextResponse(payload, {
    status: upstreamResponse.status,
    headers: { "content-type": upstreamResponse.headers.get("content-type") ?? "application/json" },
  });
}
