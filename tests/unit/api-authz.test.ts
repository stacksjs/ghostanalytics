/**
 * API authorization guardrail (issue #3).
 *
 * Site ids are public (they ride in the tracking snippet), so every site-scoped
 * read endpoint MUST be owner-gated — otherwise anyone could read any site's
 * stats. This asserts against the real route source so the gate can't be removed
 * without a red test.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const analytics = readFileSync(join(import.meta.dir, '../../routes/analytics.ts'), 'utf8')

/** Isolate a single `route.<verb>('<path>', ...)` block up to the next route. */
function routeBlock(path: string): string {
  const start = analytics.indexOf(`'${path}'`)
  if (start === -1)
    return ''
  const rest = analytics.slice(start)
  const end = rest.indexOf('\nroute.')
  return end === -1 ? rest : rest.slice(0, end)
}

const READ_ENDPOINTS = [
  '/api/sites/{siteId}/stats',
  '/api/sites/{siteId}/timeseries',
  '/api/sites/{siteId}/pages',
  '/api/sites/{siteId}/referrers',
]

describe('guardrail: site-scoped read endpoints are owner-gated', () => {
  for (const path of READ_ENDPOINTS) {
    test(`GET ${path} enforces auth + site ownership`, () => {
      const block = routeBlock(path)
      expect(block).not.toBe('')
      expect(block).toContain('requireSiteOwner(request, siteId)')
      expect(block).toContain('.middleware(\'auth\')')
    })
  }
})
