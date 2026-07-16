/**
 * Cloudflare Pages Function — live health for GET /api/v1/health
 *
 * Static fallback remains at /api/v1/health.json (time_unix: null).
 * CORS headers also documented in public/_headers.api-snippet.txt for Agent C.
 */

interface PagesFunctionContext {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction = async () => {
  const body = {
    status: "ok",
    service: "mossymesh-com",
    version: "1.0.0",
    time_unix: Math.floor(Date.now() / 1000),
    note: "Live health from Cloudflare Pages Function.",
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
};

// Cloudflare Pages supplies PagesFunction globally in the Functions runtime.
// Local type shim so editors/tsc do not require @cloudflare/workers-types.
type PagesFunction = (
  context: PagesFunctionContext,
) => Response | Promise<Response>;
