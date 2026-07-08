/**
 * Analytics tracking helpers.
 *
 * Privacy-first, cookieless. A visitor is identified by a daily-rotating hash
 * of (ip + user-agent + site), so the same person is stable within a day but
 * cannot be tracked across days — and no raw IP is ever stored.
 */

import { createHash } from 'node:crypto'

/** A parsed slice of a User-Agent string. */
export interface UaInfo {
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot'
}

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i

/** Coarse, dependency-free User-Agent parse — enough for analytics rollups. */
export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const s = ua ?? ''
  if (!s || BOT_RE.test(s))
    return { browser: 'Unknown', browserVersion: '', os: 'Unknown', osVersion: '', deviceType: BOT_RE.test(s) ? 'bot' : 'desktop' }

  const browser = matchBrowser(s)
  const os = matchOs(s)
  const deviceType = /Mobi|Android(?!.*Tablet)|iPhone/i.test(s)
    ? 'mobile'
    : /iPad|Tablet/i.test(s)
      ? 'tablet'
      : 'desktop'

  return { ...browser, ...os, deviceType }
}

function matchBrowser(s: string): { browser: string, browserVersion: string } {
  const table: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ]
  for (const [re, name] of table) {
    const m = s.match(re)
    if (m)
      return { browser: name, browserVersion: m[1] ?? '' }
  }
  return { browser: 'Unknown', browserVersion: '' }
}

function matchOs(s: string): { os: string, osVersion: string } {
  if (/Windows NT ([\d.]+)/.test(s))
    return { os: 'Windows', osVersion: RegExp.$1 }
  if (/Mac OS X ([\d_.]+)/.test(s))
    return { os: 'macOS', osVersion: RegExp.$1.replace(/_/g, '.') }
  if (/Android ([\d.]+)/.test(s))
    return { os: 'Android', osVersion: RegExp.$1 }
  if (/iPhone OS ([\d_]+)/.test(s))
    return { os: 'iOS', osVersion: RegExp.$1.replace(/_/g, '.') }
  if (/Linux/.test(s))
    return { os: 'Linux', osVersion: '' }
  return { os: 'Unknown', osVersion: '' }
}

/** Whether a request should be dropped as bot / automated traffic. */
export function isBot(ua: string | null | undefined): boolean {
  return BOT_RE.test(ua ?? '')
}

/**
 * Cookieless visitor id: sha256(ip + ua + siteId + daily-salt), truncated.
 * The salt is the UTC date, so the hash rotates every 24h and cannot be joined
 * across days. No raw IP or UA is persisted — only this opaque digest.
 */
export function hashVisitor(ip: string, ua: string, siteId: string, date = new Date()): string {
  const salt = date.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
  return createHash('sha256').update(`${ip}|${ua}|${siteId}|${salt}`).digest('hex').slice(0, 32)
}

/** Classify a referrer URL into a coarse acquisition source. */
export function referrerSource(referrer: string | null | undefined): string {
  if (!referrer)
    return 'Direct'
  let host: string
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '')
  }
  catch {
    return 'Direct'
  }
  if (/google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\./.test(host))
    return 'Search'
  if (/twitter\.|x\.com|facebook\.|linkedin\.|reddit\.|t\.co|instagram\.|youtube\./.test(host))
    return 'Social'
  return host || 'Direct'
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

/** Country from CDN geo headers (no third-party lookup, no IP storage). */
export function geoCountry(headers: Headers): string | undefined {
  return headers.get('cf-ipcountry') || headers.get('cloudfront-viewer-country') || undefined
}

/** A short, URL-safe random id (for pageview / event primary keys). */
export function randomId(): string {
  return createHash('sha256')
    .update(`${globalThis.crypto.randomUUID()}`)
    .digest('hex')
    .slice(0, 24)
}
