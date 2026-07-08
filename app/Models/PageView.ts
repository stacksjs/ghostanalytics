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
    id: { fillable: true, validation: { rule: schema.string().required() } },
    site_id: { fillable: true, validation: { rule: schema.string().required() } },
    session_id: { fillable: true, validation: { rule: schema.string().required() } },
    visitor_id: { fillable: true, validation: { rule: schema.string().required() } },
    path: { fillable: true, validation: { rule: schema.string().required() } },
    hostname: { fillable: true, validation: { rule: schema.string().optional() } },
    title: { fillable: true, validation: { rule: schema.string().optional() } },
    referrer: { fillable: true, validation: { rule: schema.string().optional() } },
    referrer_source: { fillable: true, validation: { rule: schema.string().optional() } },
    utm_source: { fillable: true, validation: { rule: schema.string().optional() } },
    utm_medium: { fillable: true, validation: { rule: schema.string().optional() } },
    utm_campaign: { fillable: true, validation: { rule: schema.string().optional() } },
    utm_content: { fillable: true, validation: { rule: schema.string().optional() } },
    utm_term: { fillable: true, validation: { rule: schema.string().optional() } },
    country: { fillable: true, validation: { rule: schema.string().optional() } },
    region: { fillable: true, validation: { rule: schema.string().optional() } },
    city: { fillable: true, validation: { rule: schema.string().optional() } },
    device_type: { fillable: true, validation: { rule: schema.string().optional() } },
    browser: { fillable: true, validation: { rule: schema.string().optional() } },
    browser_version: { fillable: true, validation: { rule: schema.string().optional() } },
    os: { fillable: true, validation: { rule: schema.string().optional() } },
    os_version: { fillable: true, validation: { rule: schema.string().optional() } },
    screen_width: { fillable: true, validation: { rule: schema.number().optional() } },
    screen_height: { fillable: true, validation: { rule: schema.number().optional() } },
    is_unique: { fillable: true, validation: { rule: schema.boolean().optional() }, factory: () => false },
    is_bounce: { fillable: true, validation: { rule: schema.boolean().optional() }, factory: () => false },
    time_on_page: { fillable: true, validation: { rule: schema.number().optional() } },
    timestamp: { fillable: true, validation: { rule: schema.string().required() } },
  },
})
