/**
 * Analytics tracking glue.
 *
 * The backend-agnostic primitives — User-Agent parsing, bot filtering,
 * referrer classification, CDN geo-header extraction — come from the shared
 * dependency-free `@ts-analytics/tracking` package.
 * Only the pieces specific to *this* app live here: cookieless daily-salt
 * visitor hashing, header IP extraction, and id generation.
 */

import { createHash } from 'node:crypto'
import { getCountryFromHeaders } from '@ts-analytics/tracking'

// Re-export the shared primitives so route code has a single import site.
export {
  isBot,
  type ParsedUserAgent,
  parseUserAgent,
  parseReferrerSource as referrerSource,
} from '@ts-analytics/tracking'

/**
 * Cookieless visitor id: sha256(ip + ua + siteId + daily-salt), truncated.
 * The salt is the UTC date, so the hash rotates every 24h and cannot be joined
 * across days. No raw IP or UA is persisted — only this opaque digest.
 */
export function hashVisitor(ip: string, ua: string, siteId: string, date = new Date()): string {
  const salt = date.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
  return createHash('sha256').update(`${ip}|${ua}|${siteId}|${salt}`).digest('hex').slice(0, 32)
}

/** Best-effort client IP from common proxy/CDN headers. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip')
    || headers.get('x-real-ip')
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '0.0.0.0'
  )
}

/** Country from CDN geo headers (via ts-analytics), no third-party lookup. */
export function geoCountry(headers: Headers): string | undefined {
  const obj: Record<string, string> = {}
  headers.forEach((v, k) => { obj[k.toLowerCase()] = v })
  return getCountryFromHeaders(obj)
}

/** A short, URL-safe random id (for pageview / event primary keys). */
export function randomId(): string {
  return createHash('sha256').update(globalThis.crypto.randomUUID()).digest('hex').slice(0, 24)
}
