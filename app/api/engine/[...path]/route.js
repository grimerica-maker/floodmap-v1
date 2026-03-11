const BACKEND_BASE = "http://137.184.86.1:8000";

async function handler(request, { params }) {
  const path = (params.path || []).join("/");
  const search = request.nextUrl.search || "";
  const targetUrl = `${BACKEND_BASE}/${path}${search}`;

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
      "Content-Type": contentType,
      "Cache-Control":
        backendResponse.headers.get("cache-control") || "no-store",
    },
  });
}

export async function GET(request, context) {
  return handler(request, context);
}
