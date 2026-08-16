/**
 * Request-boundary helpers for the public Coach API.
 *
 * Kept outside the Next route module because App Router routes may export only
 * route-handler configuration and HTTP methods.
 */
import { isIP } from "node:net";
import { hubCoachClientKey } from "@/lib/hub/coach-provider";

/** Browser Coach submissions must originate from this Hub, never a third-party form. */
export function isSameOriginHubCoachRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function trustedCloudflareClientAddress(request: Request): string | null {
  if (process.env.HUB_COACH_TRUST_PROXY !== "true") return null;
  const raw = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  return isIP(raw) === 0 ? null : raw;
}

/**
 * Do not trust X-Forwarded-For: a public direct request can forge it. Default
 * deployments intentionally share one origin bucket. A Cloudflare deployment
 * can opt into its sanitized CF-Connecting-IP header explicitly.
 */
export function hubCoachRequestClientKey(request: Request): string {
  const origin = new URL(request.url).origin;
  const raw = trustedCloudflareClientAddress(request) ?? `origin:${origin}`;
  return hubCoachClientKey(raw);
}
