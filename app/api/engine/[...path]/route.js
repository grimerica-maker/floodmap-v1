export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENGINE_BASE =
  process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL || "http://137.184.86.1:8000";

function buildTargetUrl(pathSegments = [], requestUrl) {
  const incomingUrl = new URL(requestUrl);
  const cleanBase = ENGINE_BASE.replace(/\/+$/, "");
  const joinedPath = pathSegments.length ? `/${pathSegments.join("/")}` : "";
  const target = new URL(`${cleanBase}${joinedPath}`);

  incomingUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  return target;
}

async function proxyRequest(request, context) {
  try {
    const pathSegments = context?.params?.path || [];
    const targetUrl = buildTargetUrl(pathSegments, request.url);

    const method = request.method.toUpperCase();
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

    const upstream = await fetch(targetUrl.toString(), init);

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("access-control-allow-origin", "*");
    responseHeaders.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    responseHeaders.set("access-control-allow-headers", "*");
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
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
}

export async function GET(request, context) {
  return proxyRequest(request, context);
}

export async function POST(request, context) {
  return proxyRequest(request, context);
}

export async function PUT(request, context) {
  return proxyRequest(request, context);
}

export async function PATCH(request, context) {
  return proxyRequest(request, context);
}

export async function DELETE(request, context) {
  return proxyRequest(request, context);
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
