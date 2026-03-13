import { NextResponse } from "next/server";

const ENGINE_BASE = process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL;

async function handler(request, { params }) {
  const path = (params.path || []).join("/");
  const search = request.nextUrl.search || "";
  const url = `${ENGINE_BASE.replace(/\/+$/, "")}/${path}${search}`;

  const upstream = await fetch(url, {
    method: request.method,
    headers: {
      Accept: request.headers.get("accept") || "*/*",
    },
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET(request, context) {
  return handler(request, context);
}
