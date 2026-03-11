const BACKEND_BASE = "http://137.184.86.1:8000";

export async function GET(request) {
  const search = request.nextUrl.search || "";
  const targetUrl = `${BACKEND_BASE}/${search}`;

  const backendResponse = await fetch(targetUrl, {
    method: "GET",
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
