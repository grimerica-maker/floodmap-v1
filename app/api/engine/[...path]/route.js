import { NextResponse } from "next/server";

const ENGINE_BASE =
  process.env.FLOOD_ENGINE_URL ||
  process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL ||
  "http://137.184.86.1:8000";

async function handler(request, { params }) {
  const path = Array.isArray(params?.path) ? params.path.join("/") : "";
  const search = request.nextUrl.search || "";
  const base = ENGINE_BASE.replace(/\/+$/, "");
  const url = `${base}/${path}${search}`;

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: {
        Accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
    });

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": contentType.startsWith("image/")
          ? "public, max-age=3600"
          : "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Proxy request failed",
        engine_base: base,
        path,
        detail: String(error),
      },
      { status: 502 }
    );
  }
}

export async function GET(request, context) {
  return handler(request, context);
}
