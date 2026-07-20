/**
 * Referrer privacy (issue #6).
 *
 * A stored referrer must never keep its query string or fragment — those can
 * carry identifiers minted by the referring site. `cleanReferrer` keeps only
 * origin + path, and the ingest must use it (not the raw clipper).
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanReferrer } from '../../app/Analytics/tracking'

describe('cleanReferrer strips identifiers', () => {
  test('drops the query string', () => {
    expect(cleanReferrer('https://google.com/search?q=secret+term&uid=abc123')).toBe('https://google.com/search')
  })

  test('drops the fragment', () => {
    expect(cleanReferrer('https://example.com/page#section-2')).toBe('https://example.com/page')
  })

  test('drops both query and fragment', () => {
    expect(cleanReferrer('https://a.com/p?click_id=xyz#frag')).toBe('https://a.com/p')
  })

  test('keeps host + path (the useful part)', () => {
    expect(cleanReferrer('https://ref.io/articles/hello')).toBe('https://ref.io/articles/hello')
  })

  test('normalizes a bare origin deterministically', () => {
    expect(cleanReferrer('https://x.com')).toBe('https://x.com/')
    expect(cleanReferrer('https://x.com/')).toBe('https://x.com/')
  })

  test('blank / non-string → null', () => {
    expect(cleanReferrer('')).toBeNull()
    expect(cleanReferrer('   ')).toBeNull()
    expect(cleanReferrer(undefined)).toBeNull()
    expect(cleanReferrer(null)).toBeNull()
    expect(cleanReferrer(42)).toBeNull()
  })

  test('non-URL values still get query/fragment stripped', () => {
    expect(cleanReferrer('not a url?token=leak')).toBe('not a url')
  })

  test('clips to varchar(255)', () => {
    const long = `https://x.com/${'a'.repeat(400)}`
    expect(cleanReferrer(long)!.length).toBe(255)
  })
})

describe('guardrail: the ingest stores a cleaned referrer', () => {
  const analytics = readFileSync(join(import.meta.dir, '../../routes/analytics.ts'), 'utf8')

  test('referrer columns are populated via cleanReferrer, never the raw clipper', () => {
    expect(analytics).toContain('referrer: cleanReferrer(body.r)')
    expect(analytics).not.toContain('referrer: clip255(body.r)')
  })
})
