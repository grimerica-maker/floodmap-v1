const FLOOD_ENGINE_BASE_URL =
  process.env.FLOOD_ENGINE_BASE_URL ||
  process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL ||
  "http://137.184.86.1:8000";

const buildTargetUrl = (pathParts, requestUrl) => {
  const base = FLOOD_ENGINE_BASE_URL.replace(/\/+$/, "");
  const path = (pathParts || []).join("/");
  const incoming = new URL(requestUrl);
  const search = incoming.search || "";

  return `${base}/${path}${search}`;
};

const proxyRequest = async (request, context) => {
  const targetUrl = buildTargetUrl(context?.params?.path, request.url);

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: {
      accept: request.headers.get("accept") || "*/*",
    },
    cache: "no-store",
  });

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const cacheControl = upstream.headers.get("cache-control");

  if (contentType) headers.set("content-type", contentType);
  if (cacheControl) headers.set("cache-control", cacheControl);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
};

export async function GET(request, context) {
  return proxyRequest(request, context);
}

export async function HEAD(request, context) {
  return proxyRequest(request, context);
}
