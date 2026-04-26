// Centralized response helpers for /api/* routes. All API responses go
// through these so we have one place to evolve the security-header set
// (rather than chasing every route file).
//
// Headers applied:
//   Strict-Transport-Security  — force HTTPS for 2 years across subdomains.
//   X-Content-Type-Options     — disable MIME sniffing.
//   X-Frame-Options            — block iframe embedding.
//   Referrer-Policy            — minimum referrer leak across origins.
//   Permissions-Policy         — disable powerful APIs by default.
//   Cache-Control: no-store    — API responses are personalized; never cache.
//
// Content-Security-Policy is intentionally NOT applied here. It belongs
// at the HTML response surface (SSR root) and would do nothing useful on
// JSON. A separate phase wires CSP onto the document response.

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Cache-Control": "no-store",
};

function withSecurityHeaders(extra: Record<string, string> = {}): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

export function secureJsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  const headers = withSecurityHeaders({ "Content-Type": "application/json", ...extra });
  return new Response(JSON.stringify(body), { status, headers });
}

export function secureRedirect(location: string, extra: Record<string, string> = {}): Response {
  const headers = withSecurityHeaders({ Location: location, ...extra });
  return new Response(null, { status: 302, headers });
}

export function secureTextResponse(body: string, status = 200): Response {
  const headers = withSecurityHeaders({ "Content-Type": "text/plain" });
  return new Response(body, { status, headers });
}

// Best-effort client-IP extraction. Cloudflare sets CF-Connecting-IP;
// fall back to X-Forwarded-For (first hop) and finally a stable sentinel
// so we never crash key construction. The "unknown" key effectively
// shares one bucket across un-attributable callers — that's OK because
// limits are loose and this is per-isolate anyway.
export function getClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
