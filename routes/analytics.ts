/**
 * ghostanalytics — ingest + stats API.
 *
 * The public tracker (served at `/script.js`) beacons page views and custom
 * events to `POST /collect`. The dashboard reads aggregates from the
 * `GET /api/sites/{siteId}/*` endpoints. All storage is SingleStore, queried
 * through bun-query-builder's `db`.
 */

import { createHash } from 'node:crypto'
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

/** Trim a UTM param to a non-empty varchar(255), or null when absent/blank. */
function utmParam(v: unknown): string | null {
  if (typeof v !== 'string')
    return null
  const t = v.trim()
  return t ? t.slice(0, 255) : null
}

/**
 * Goal-matching contract. A goal targets either a `pageview` (matched against
 * the page path) or an `event` (matched against the custom event name), using
 * one of three `match_type`s. Returns whether the current hit fires this goal.
 * NOTE: duration_minutes-based goals are out of scope this round (future work).
 */
interface GoalRow {
  id: string
  type: string | null
  pattern: string | null
  match_type: string | null
  value: number | null
}

function matchesGoal(
  goal: GoalRow,
  hit: { isPageview: boolean, path: string, eventName: string },
): boolean {
  const wantPageview = goal.type === 'pageview'
  // A pageview goal never matches an event hit, and vice-versa.
  if (wantPageview !== hit.isPageview)
    return false
  const subject = wantPageview ? hit.path : hit.eventName
  const pattern = goal.pattern ?? ''
  switch (goal.match_type) {
    case 'contains':
      return subject.includes(pattern)
    case 'starts_with':
      return subject.startsWith(pattern)
    case 'exact':
    default:
      return subject === pattern
  }
}

/**
 * Deterministic conversion id = sha256(session_id|goal_id), truncated. Combined
 * with insertOrIgnore (which emits `INSERT IGNORE` on the mysql/SingleStore
 * dialect), this enforces exactly one conversion per session per goal: a repeat
 * beacon in the same session recomputes the same id and the insert is a no-op.
 */
function conversionId(sessionId: string, goalId: string): string {
  return createHash('sha256').update(`${sessionId}|${goalId}`).digest('hex').slice(0, 32)
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

  // Ensure the site row exists before any child insert. sessions, page_views,
  // custom_events and conversions all FK to sites.id, so a first-ever hit for a
  // site would otherwise fail the constraint (500). insertOrIgnore self-registers
  // the site on its first beacon and is a no-op on every hit after.
  await db.insertOrIgnore('sites', {
    id: String(siteId),
    created_at: now,
  }).catch(() => {})

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
      utm_source: utmParam(body.utm_source),
      utm_medium: utmParam(body.utm_medium),
      utm_campaign: utmParam(body.utm_campaign),
      utm_content: utmParam(body.utm_content),
      utm_term: utmParam(body.utm_term),
      country: country ?? null,
      device_type: info.deviceType,
      browser: info.browser,
      browser_version: null,
      os: info.os,
      os_version: null,
      screen_width: body.sw ?? null,
      screen_height: body.sh ?? null,
      is_unique: false,
      is_bounce: false,
      timestamp: now,
    }).execute()
  }
  else {
    // Reserved auto-tracked events (Outbound Link / File Download) carry only a url. Store
    // it canonically as {"url":...} regardless of any extra keys / key-order a caller sends,
    // so the dashboard's GROUP BY properties aggregates exactly one row per URL — a client
    // can't split or pollute a URL's row by appending junk keys.
    let props = body.p ? JSON.stringify(body.p) : null
    if ((String(event) === 'Outbound Link' || String(event) === 'File Download') && body.p && body.p.url) {
      let url = String(body.p.url)
      props = JSON.stringify({ url })
      // properties is varchar(255): trim the url until the wrapped JSON fits, so it stays
      // valid JSON (the dashboard JSON.parses it) and never overflows the column — an
      // overflow would 500 on strict MySQL or, on SingleStore, silently truncate and then
      // collate distinct urls that share a 255-char prefix into one row. Only pathologically
      // long hrefs hit the loop. (TODO: widen custom_events.properties for full-length urls.)
      while (props.length > 255 && url.length) {
        url = url.slice(0, -8)
        props = JSON.stringify({ url })
      }
    }
    // .catch like the sites/sessions inserts above: a storage failure (e.g. an over-length
    // non-reserved props blob under strict sql_mode) must never 500 the public beacon.
    await db.insertInto('custom_events').values({
      id: randomId(),
      site_id: String(siteId),
      session_id: sessionId,
      visitor_id: visitorId,
      name: String(event),
      properties: props,
      path,
      timestamp: now,
    }).execute().catch(() => {})
  }

  // Goal / conversion matching. Runs AFTER the session insert above so the
  // conversions.session_id FK is satisfied. Wrapped in try/catch (and each
  // insert is insertOrIgnore + .catch) so a goals failure can never break the
  // pageview 204. Hot-path cost: one indexed SELECT per beacon (+ up to N tiny
  // insertOrIgnores); goals-per-site is small, so this is fine for now — cache
  // per-site active goals with a short TTL later if it ever matters.
  try {
    const isPageview = event === 'pageview'
    const eventName = String(event)
    const goals = await db.unsafe(
      `SELECT id, type, pattern, match_type, value FROM goals WHERE site_id = ? AND is_active = 1 LIMIT 100`,
      [String(siteId)],
    )
    for (const goal of (goals ?? []) as GoalRow[]) {
      if (!matchesGoal(goal, { isPageview, path, eventName }))
        continue
      // Deterministic id + INSERT IGNORE => once per session per goal. Stores the
      // goal's value and this beacon's attribution + timestamp.
      await db.insertOrIgnore('conversions', {
        id: conversionId(sessionId, goal.id),
        site_id: String(siteId),
        goal_id: goal.id,
        visitor_id: visitorId,
        session_id: sessionId,
        value: goal.value ?? null,
        path,
        referrer_source: source,
        utm_source: utmParam(body.utm_source),
        utm_campaign: utmParam(body.utm_campaign),
        timestamp: now,
      }).catch(() => {})
    }
  }
  catch { /* goals/conversions are best-effort; never block the beacon */ }

  return new Response(null, { status: 204, headers: CORS })
})
  // Public cross-origin, cookieless tracking beacon — no CSRF cookie can ride
  // along (like a webhook), so opt out of the default-on CSRF check.
  .skipCsrf()

// ---------------------------------------------------------------------------
// Stats (dashboard)
// ---------------------------------------------------------------------------

// Reads go through db.unsafe (parameterized): schema-independent, correct for
// GROUP BY aggregates, and skips the global soft-delete filter these tables
// don't participate in. Timestamps are stored as ISO strings, whose
// lexicographic order matches chronological order, so string range works.
// ---------------------------------------------------------------------------
// Goals (management API)
// ---------------------------------------------------------------------------

const GOAL_TYPES = new Set(['pageview', 'event'])
const GOAL_MATCH_TYPES = new Set(['exact', 'contains', 'starts_with'])

route.options('/api/sites/{siteId}/goals', () => new Response(null, { status: 204, headers: CORS }))

route.get('/api/sites/{siteId}/goals', async (request: any) => {
  const siteId = request.params.siteId
  const rows = await db.unsafe(
    `SELECT id, site_id, name, type, pattern, match_type, value, is_active
    FROM goals WHERE site_id = ? ORDER BY created_at DESC`,
    [siteId],
  )
  return json({ goals: rows ?? [] })
}).middleware('auth')

route.post('/api/sites/{siteId}/goals', async (request: any) => {
  const siteId = request.params.siteId
  const body = request.jsonBody ?? {}
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 255) : ''
  const type = String(body.type ?? '')
  const pattern = typeof body.pattern === 'string' ? body.pattern.trim().slice(0, 255) : ''
  const matchType = String(body.match_type ?? 'exact')
  const value = body.value == null || body.value === '' ? null : Number(body.value)

  if (!name)
    return json({ error: 'name is required' }, 400)
  if (!GOAL_TYPES.has(type))
    return json({ error: 'type must be pageview or event' }, 400)
  if (!GOAL_MATCH_TYPES.has(matchType))
    return json({ error: 'match_type must be exact, contains, or starts_with' }, 400)
  if (!pattern)
    return json({ error: 'pattern is required' }, 400)
  if (value != null && !Number.isFinite(value))
    return json({ error: 'value must be a finite number' }, 400)

  // Cap active goals per site to bound the /collect matching loop (defense-in-depth).
  const activeCount = (await db.unsafe(`SELECT COUNT(*) AS n FROM goals WHERE site_id = ? AND is_active = 1`, [String(siteId)]))?.[0]?.n
  if (Number(activeCount ?? 0) >= 50)
    return json({ error: 'active goal limit reached (50)' }, 409)

  const now = new Date().toISOString()
  // Self-register the site (goals.site_id FKs to sites.id) before the child insert.
  await db.insertOrIgnore('sites', { id: String(siteId), created_at: now }).catch(() => {})

  const id = randomId()
  await db.insertInto('goals').values({
    id,
    site_id: String(siteId),
    name,
    type,
    pattern,
    match_type: matchType,
    value,
    is_active: true,
  }).execute()

  return json({ goal: { id, site_id: String(siteId), name, type, pattern, match_type: matchType, value, is_active: true } }, 201)
})
  // Management endpoint: require an authenticated user (bearer token — CSRF-immune).
  // Full per-site ownership check against sites.owner_id is a follow-up.
  .middleware('auth')
  .skipCsrf()

route.get('/api/sites/{siteId}/stats', async (request: any) => {
  const siteId = request.params.siteId
  const { from, to } = window(request)
  const row = (await db.unsafe(
    `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions
    FROM page_views WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?`,
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
    `SELECT LEFT(timestamp, 10) AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
    FROM page_views WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
    GROUP BY LEFT(timestamp, 10) ORDER BY day ASC`,
    [siteId, from, to],
  )
  return json({ series: rows ?? [] })
})

route.get('/api/sites/{siteId}/pages', async (request: any) => {
  const siteId = request.params.siteId
  const { from, to } = window(request)
  const rows = await db.unsafe(
    `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
    FROM page_views WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
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
    FROM page_views WHERE site_id = ? AND timestamp >= ? AND timestamp <= ?
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
    var q=new URLSearchParams(location.search),
      b={s:site,sid:sid,e:e,p:p||{},u:location.origin+location.pathname,r:d.referrer||'',t:d.title,sw:screen.width,sh:screen.height};
    ['source','medium','campaign','content','term'].forEach(function(k){var v=q.get('utm_'+k);if(v)b['utm_'+k]=v});
    fetch('${origin}/collect',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
  }catch(_){}}
  w.ghost=function(name,props){send(name,props)};
  var DLRE=/\.(pdf|zip|dmg|exe|csv|xlsx?|docx?|pptx?|mp3|mp4|pkg|rar|gz|tar|wav|avi|mov|mkv|txt|svg)$/i;
  function onLink(ev){
    if(ev.type==='auxclick'&&ev.button!==1)return;
    try{
      var t=ev.target,a=t&&t.closest?t.closest('a'):null;
      if(!a)return;
      var href=a.getAttribute('href');if(!href)return;
      if(/^(javascript:|mailto:|tel:)/i.test(href))return;
      var url=new URL(a.href,location.href);
      if(url.protocol!=='http:'&&url.protocol!=='https:')return;
      var cross=url.hostname!==location.hostname,path=url.pathname;
      if((a.hasAttribute('download')&&!cross)||DLRE.test(path)){send('File Download',{url:a.href});return}
      if(cross){send('Outbound Link',{url:a.href})}
    }catch(_){}
  }
  d.addEventListener('click',onLink,true);
  d.addEventListener('auxclick',onLink,true);
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
