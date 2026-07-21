import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Session',
  table: 'sessions',
  primaryKey: 'id',

  // SingleStore: append-heavy columnstore fact table. Shard on the
  // high-cardinality id (a columnstore PK must contain the shard key), and
  // sort on the analytics filter+range (site_id, started_at) for columnstore
  // segment elimination on time-scoped per-site scans.
  tableKind: 'columnstore',
  shardKey: ['id'],
  sortKey: ['site_id', 'started_at'],

  traits: {
    useTimestamps: true,
  },

  belongsTo: ['Site'],
  hasMany: ['PageView', 'CustomEvent'],

  indexes: [
    { name: 'sessions_site_started', columns: ['site_id', 'started_at'] },
    { name: 'sessions_visitor', columns: ['visitor_id'] },
  ],

  attributes: {
    id: { fillable: true, validation: { rule: schema.string().required().max(64) } },
    site_id: { fillable: true, validation: { rule: schema.string().required().max(64) } },
    visitor_id: { fillable: true, validation: { rule: schema.string().required().max(64) } },
    entry_path: { fillable: true, validation: { rule: schema.string().optional() } },
    exit_path: { fillable: true, validation: { rule: schema.string().optional() } },
    referrer: { fillable: true, validation: { rule: schema.string().optional() } },
    referrer_source: { fillable: true, validation: { rule: schema.string().optional().max(128) } },
    utm_source: { fillable: true, validation: { rule: schema.string().optional().max(128) } },
    utm_medium: { fillable: true, validation: { rule: schema.string().optional().max(64) } },
    utm_campaign: { fillable: true, validation: { rule: schema.string().optional().max(128) } },
    country: { fillable: true, validation: { rule: schema.string().optional().max(2) } },
    device_type: { fillable: true, validation: { rule: schema.string().optional().max(16) } },
    browser: { fillable: true, validation: { rule: schema.string().optional().max(32) } },
    os: { fillable: true, validation: { rule: schema.string().optional().max(32) } },
    page_view_count: { fillable: true, validation: { rule: schema.number().optional() }, factory: () => 0 },
    event_count: { fillable: true, validation: { rule: schema.number().optional() }, factory: () => 0 },
    is_bounce: { fillable: true, validation: { rule: schema.boolean().optional() }, factory: () => true },
    duration: { fillable: true, validation: { rule: schema.number().optional() }, factory: () => 0 },
    started_at: { fillable: true, validation: { rule: schema.string().required().max(32) } },
    ended_at: { fillable: true, validation: { rule: schema.string().optional().max(32) } },
  },
})
