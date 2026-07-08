/**
 * ghostanalytics — ingest + stats API.
 *
 * The public tracker (served at `/script.js`) beacons page views and custom
 * events to `POST /collect`. The dashboard reads aggregates from the
 * `GET /api/sites/{siteId}/*` endpoints. All storage is SingleStore, queried
 * through bun-query-builder's `db`.
 */

import { db } from '@stacksjs/database'
import { response, route } from '@stacksjs/router'
import {
  clientIp,
  geoCountry,
  hashVisitor,
  isBot,
  parseUserAgent,
  randomId,
  referrerSource,
} from '../app/Analytics/tracking'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

/** Parse a `from`/`to` window from the query string, defaulting to last 7d. */
function window(req: { query: Record<string, any> }): { from: string, to: string } {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 864e5)
  const from = (req.query?.from as string) || weekAgo.toISOString()
  const to = (req.query?.to as string) || now.toISOString()
  return { from, to }
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

route.options('/collect', () => new Response(null, { status: 204, headers: CORS }))

route.post('/collect', async (request: any) => {
  const body = request.jsonBody ?? {}
  const siteId = body.s
  if (!siteId)
    return json({ error: 'missing site' }, 400)

  const ua = request.headers?.get('user-agent') ?? ''
  if (isBot(ua))
    return new Response(null, { status: 204, headers: CORS })

  const ip = clientIp(request.headers)
  const visitorId = hashVisitor(ip, ua, String(siteId))
  const sessionId = body.sid ? String(body.sid) : visitorId
  const info = parseUserAgent(ua)
  const country = geoCountry(request.headers)
  const now = new Date().toISOString()

  let url: URL | null = null
  try {
    url = body.u ? new URL(body.u) : null
  }
  catch { /* ignore malformed url */ }
  const path = url?.pathname ?? '/'
  const source = referrerSource(body.r)

  // Create the session on the first hit; ignore on later hits (same session id).
  await db.insertOrIgnore('sessions', {
    id: sessionId,
    site_id: String(siteId),
    visitor_id: visitorId,
    entry_path: path,
    exit_path: path,
    referrer: body.r ?? null,
    referrer_source: source,
    country: country ?? null,
    device_type: info.deviceType,
    browser: info.browser,
    os: info.os,
    page_view_count: 0,
    event_count: 0,
    is_bounce: true,
    duration: 0,
    started_at: now,
  }).catch(() => {})

  const event = body.e ?? 'pageview'
  if (event === 'pageview') {
    await db.insertInto('page_views').values({
      id: randomId(),
      site_id: String(siteId),
      session_id: sessionId,
      visitor_id: visitorId,
      path,
      hostname: url?.hostname ?? null,
      title: body.t ?? null,
      referrer: body.r ?? null,
      referrer_source: source,
      country: country ?? null,
      device_type: info.deviceType,
      browser: info.browser,
      browser_version: info.browserVersion,
      os: info.os,
      os_version: info.osVersion,
      screen_width: body.sw ?? null,
      screen_height: body.sh ?? null,
      is_unique: false,
      is_bounce: false,
      timestamp: now,
    }).execute()
  }
  else {
    await db.insertInto('custom_events').values({
      id: randomId(),
      site_id: String(siteId),
      session_id: sessionId,
      visitor_id: visitorId,
      name: String(event),
      properties: body.p ? JSON.stringify(body.p) : null,
      path,
      timestamp: now,
    }).execute()
  }

  return new Response(null, { status: 204, headers: CORS })
})

// ---------------------------------------------------------------------------
// Stats (dashboard)
// ---------------------------------------------------------------------------

// Reads go through db.unsafe (parameterized): schema-independent, correct for
// GROUP BY aggregates, and skips the global soft-delete filter these tables
// don't participate in. Timestamps are stored as ISO strings, whose
// lexicographic order matches chronological order, so string range works.
route.get('/api/sites/{siteId}/stats', async (request: any) => {
  const siteId = request.params.siteId
  const { from, to } = window(request)
  const row = (await db.unsafe(
    `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions
     FROM page_views WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3`,
    [siteId, from, to],
  ))?.[0]
  return json({
    views: Number(row?.views ?? 0),
    visitors: Number(row?.visitors ?? 0),
    sessions: Number(row?.sessions ?? 0),
    range: { from, to },
  })
})

route.get('/api/sites/{siteId}/timeseries', async (request: any) => {
  const siteId = request.params.siteId
  const { from, to } = window(request)
  const rows = await db.unsafe(
    `SELECT DATE(timestamp) AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
     FROM page_views WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3
     GROUP BY DATE(timestamp) ORDER BY day ASC`,
    [siteId, from, to],
  )
  return json({ series: rows ?? [] })
})

route.get('/api/sites/{siteId}/pages', async (request: any) => {
  const siteId = request.params.siteId
  const { from, to } = window(request)
  const rows = await db.unsafe(
    `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
     FROM page_views WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3
     GROUP BY path ORDER BY views DESC LIMIT 20`,
    [siteId, from, to],
  )
  return json({ pages: rows ?? [] })
})

route.get('/api/sites/{siteId}/referrers', async (request: any) => {
  const siteId = request.params.siteId
  const { from, to } = window(request)
  const rows = await db.unsafe(
    `SELECT referrer_source AS source, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
     FROM page_views WHERE site_id = $1 AND timestamp >= $2 AND timestamp <= $3
     GROUP BY referrer_source ORDER BY views DESC LIMIT 20`,
    [siteId, from, to],
  )
  return json({ referrers: rows ?? [] })
})

// ---------------------------------------------------------------------------
// Tracker script + health
// ---------------------------------------------------------------------------

route.get('/script.js', (request: any) => {
  const origin = new URL(request.url).origin
  const script = `(function(){
  var d=document,w=window,s=d.currentScript,site=s&&s.getAttribute('data-site');
  if(!site)return;
  var sid=(w.crypto&&w.crypto.randomUUID?w.crypto.randomUUID():Math.random().toString(36).slice(2));
  function send(e,p){try{
    fetch('${origin}/collect',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},
      body:JSON.stringify({s:site,sid:sid,e:e,p:p||{},u:location.origin+location.pathname,r:d.referrer||'',t:d.title,sw:screen.width,sh:screen.height})});
  }catch(_){}}
  w.ghost=function(name,props){send(name,props)};
  function pv(){send('pageview')}
  pv();
  var push=history.pushState;history.pushState=function(){push.apply(this,arguments);pv()};
  w.addEventListener('popstate',pv);
})();`
  return new Response(script, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ...CORS },
  })
})

route.get('/health', () => response.json({ status: 'ok', app: 'ghostanalytics' }))
