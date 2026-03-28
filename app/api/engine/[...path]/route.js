export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENGINE_BASE =
  process.env.FLOOD_ENGINE_URL ||
  process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL ||
  "http://137.184.86.1:8000";

function makeUpstreamUrl(path = [], requestUrl) {
  const incoming = new URL(requestUrl);
  const cleanBase = ENGINE_BASE.replace(/\/+$/, "");
  const joinedPath = Array.isArray(path) && path.length ? `/${path.join("/")}` : "";
  const upstream = new URL(`${cleanBase}${joinedPath}`);
  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });
  return upstream.toString();
}

async function forwardRequest(request, path = []) {
  const method = request.method.toUpperCase();
  const url = makeUpstreamUrl(path, request.url);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  const init = {
    method,
    headers,
    redirect: "follow",
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  const upstream = await fetch(url, init);
  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    outHeaders.set(key, value);
  });
  outHeaders.set("access-control-allow-origin", "*");
  outHeaders.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  outHeaders.set("access-control-allow-headers", "*");
  outHeaders.set("cache-control", "no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

function errorResponse(error) {
  return new Response(
    JSON.stringify({
      error: "Engine proxy failed",
      detail: error instanceof Error ? error.message : String(error),
      engineBase: ENGINE_BASE,
    }),
    {
      status: 502,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    }
  );
}

export async function GET(request, { params }) {
  try {
    return await forwardRequest(request, params?.path || []);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    return await forwardRequest(request, params?.path || []);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request, { params }) {
  try {
    return await forwardRequest(request, params?.path || []);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    return await forwardRequest(request, params?.path || []);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    return await forwardRequest(request, params?.path || []);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "*",
      "cache-control": "no-store",
    },
  });
}
