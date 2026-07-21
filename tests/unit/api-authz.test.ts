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
  '/api/sites/{siteId}/events',
  '/api/sites/{siteId}/entry-pages',
  '/api/sites/{siteId}/exit-pages',
  '/api/sites/{siteId}/realtime',
]

// The page_views breakdowns are registered through one shared helper.
const TOP_DIMENSIONS = [
  '/api/sites/{siteId}/countries',
  '/api/sites/{siteId}/devices',
  '/api/sites/{siteId}/browsers',
  '/api/sites/{siteId}/operating-systems',
  '/api/sites/{siteId}/utm/sources',
  '/api/sites/{siteId}/utm/mediums',
  '/api/sites/{siteId}/utm/campaigns',
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

describe('guardrail: top-dimension reports are owner-gated', () => {
  test('the topDimension helper enforces auth + site ownership', () => {
    const i = analytics.indexOf('function topDimension(')
    expect(i).toBeGreaterThan(-1)
    const block = analytics.slice(i, i + 900)
    expect(block).toContain('requireSiteOwner(request, siteId)')
    expect(block).toContain('.middleware(\'auth\')')
  })

  for (const path of TOP_DIMENSIONS) {
    test(`${path} is registered through the gated helper`, () => {
      expect(analytics).toContain(`topDimension('${path}'`)
    })
  }
})

// Erasure endpoints delete data, so they must be at least as gated as reads.
const DELETE_DECLS = [
  'route.delete(\'/api/sites/{siteId}/data\'',
  'route.delete(\'/api/sites/{siteId}/visitors/{visitorId}\'',
]

// Site management (rename/edit + cascade delete) mutates owner data too.
const MGMT_DECLS = [
  'route.patch(\'/api/sites/{siteId}\'',
  'route.delete(\'/api/sites/{siteId}\'',
]

describe('guardrail: owner-gated mutation endpoints', () => {
  for (const decl of [...DELETE_DECLS, ...MGMT_DECLS]) {
    test(`${decl.slice(12)} enforces auth + site ownership`, () => {
      const i = analytics.indexOf(decl)
      expect(i).toBeGreaterThan(-1)
      const rest = analytics.slice(i)
      const end = rest.indexOf('\nroute.')
      const block = end === -1 ? rest : rest.slice(0, end)
      expect(block).toContain('requireSiteOwner(request, siteId)')
      expect(block).toContain('.middleware(\'auth\')')
    })
  }
})
