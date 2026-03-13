export const dynamic = "force-dynamic";
export const revalidate = 0;

const BACKEND_BASE =
  process.env.FLOOD_ENGINE_URL ||
  process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL ||
  "http://137.184.86.1:8000";

async function handler(request, { params }) {
  const path = (params?.path || []).join("/");
  const search = request.nextUrl.search || "";
  const targetUrl = `${BACKEND_BASE.replace(/\/+$/, "")}/${path}${search}`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
    });

    const contentType = backendResponse.headers.get("content-type") || "";
    const body = await backendResponse.arrayBuffer();

    return new Response(body, {
      status: backendResponse.status,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Engine proxy failed:", targetUrl, error);

    return new Response("Engine proxy failed", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

export async function GET(request, context) {
  return handler(request, context);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    },
  });
}
