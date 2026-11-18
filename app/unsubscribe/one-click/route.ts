import { NextRequest } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return Response.json(
      { detail: "The unsubscribe link is missing its token." },
      { status: 400 },
    );
  }
  const confirmationUrl = new URL("/unsubscribe", request.nextUrl.origin);
  confirmationUrl.searchParams.set("token", token);
  return Response.redirect(confirmationUrl, 303);
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return Response.json(
      { detail: "The unsubscribe link is missing its token." },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL(
    `${API_BASE_URL.replace(/\/+$/, "")}/unsubscribe/one-click`,
  );
  upstreamUrl.searchParams.set("token", token);
  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type":
        request.headers.get("content-type") ?? "application/x-www-form-urlencoded",
    },
    body: await request.arrayBuffer(),
  });
  if (upstream.ok) {
    return new Response(null, { status: 204 });
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
