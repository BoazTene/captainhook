import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://localhost:8000";

function getBackendBaseUrl(): string {
  return process.env.BACKEND_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BACKEND_URL;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  const body = await request.text();
  const { eventId } = await context.params;
  const backendBaseUrl = getBackendBaseUrl();
  const upstreamUrl = new URL(`/api/v1/events/${eventId}`, backendBaseUrl);

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: "PUT",
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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const backendBaseUrl = getBackendBaseUrl();
  const upstreamUrl = new URL(`/api/v1/events/${eventId}`, backendBaseUrl);

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: "DELETE",
    cache: "no-store",
  });

  const payload = await upstreamResponse.text();
  return new NextResponse(payload, {
    status: upstreamResponse.status,
    headers: { "content-type": upstreamResponse.headers.get("content-type") ?? "application/json" },
  });
}
