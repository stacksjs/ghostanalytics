import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'PageView',
  table: 'page_views',
  primaryKey: 'id',

  // SingleStore: append-heavy columnstore fact table. Shard on the
  // high-cardinality id (a columnstore PK must contain the shard key), and
  // sort on the analytics filter+range (site_id, timestamp) so time-scoped
  // per-site scans get columnstore segment elimination.
  tableKind: 'columnstore',
  shardKey: ['id'],
  sortKey: ['site_id', 'timestamp'],

  traits: {
    useTimestamps: true,
  },

  belongsTo: ['Site', 'Session'],

  // KEYS on every column the dashboard filters/groups by. On a SingleStore
  // columnstore these become hash indexes that keep filtered breakdowns
  // (by page, source, country, device, browser, OS) fast even at billions of
  // rows — the same "keys on all filterable fields" strategy Fathom uses for
  // its V3 filtering.
  indexes: [
    { name: 'pv_site_timestamp', columns: ['site_id', 'timestamp'] },
    { name: 'pv_session', columns: ['session_id'] },
    { name: 'pv_visitor', columns: ['visitor_id'] },
    { name: 'pv_path', columns: ['path'] },
    { name: 'pv_referrer_source', columns: ['referrer_source'] },
    { name: 'pv_country', columns: ['country'] },
    { name: 'pv_device_type', columns: ['device_type'] },
    { name: 'pv_browser', columns: ['browser'] },
    { name: 'pv_os', columns: ['os'] },
    { name: 'pv_utm_source', columns: ['utm_source'] },
  ],

  attributes: {
    // Column widths are tightened to what each field actually holds (hash ids,
    // 2-char country codes, short device/browser labels) so SingleStore's
    // columnstore reserves + scans fewer bytes per row — Fathom's column-width
    // pass. Genuinely long fields (path, title, referrer) keep varchar(255).
    id: { fillable: true, validation: { rule: schema.string().required().max(64) } },
    site_id: { fillable: true, validation: { rule: schema.string().required().max(64) } },
    session_id: { fillable: true, validation: { rule: schema.string().required().max(64) } },
    visitor_id: { fillable: true, validation: { rule: schema.string().required().max(64) } },
    path: { fillable: true, validation: { rule: schema.string().required() } },
    hostname: { fillable: true, validation: { rule: schema.string().optional().max(128) } },
    title: { fillable: true, validation: { rule: schema.string().optional() } },
    referrer: { fillable: true, validation: { rule: schema.string().optional() } },
    referrer_source: { fillable: true, validation: { rule: schema.string().optional().max(128) } },
    utm_source: { fillable: true, validation: { rule: schema.string().optional().max(255) } },
    utm_medium: { fillable: true, validation: { rule: schema.string().optional().max(255) } },
    utm_campaign: { fillable: true, validation: { rule: schema.string().optional().max(255) } },
    utm_content: { fillable: true, validation: { rule: schema.string().optional().max(255) } },
    utm_term: { fillable: true, validation: { rule: schema.string().optional().max(255) } },
    country: { fillable: true, validation: { rule: schema.string().optional().max(2) } },
    region: { fillable: true, validation: { rule: schema.string().optional().max(64) } },
    city: { fillable: true, validation: { rule: schema.string().optional().max(128) } },
    device_type: { fillable: true, validation: { rule: schema.string().optional().max(16) } },
    browser: { fillable: true, validation: { rule: schema.string().optional().max(32) } },
    browser_version: { fillable: true, validation: { rule: schema.string().optional().max(32) } },
    os: { fillable: true, validation: { rule: schema.string().optional().max(32) } },
    os_version: { fillable: true, validation: { rule: schema.string().optional().max(32) } },
    screen_width: { fillable: true, validation: { rule: schema.number().optional() } },
    screen_height: { fillable: true, validation: { rule: schema.number().optional() } },
    is_unique: { fillable: true, validation: { rule: schema.boolean().optional() }, factory: () => false },
    is_bounce: { fillable: true, validation: { rule: schema.boolean().optional() }, factory: () => false },
    time_on_page: { fillable: true, validation: { rule: schema.number().optional() } },
    timestamp: { fillable: true, validation: { rule: schema.string().required().max(32) } },
  },
})
