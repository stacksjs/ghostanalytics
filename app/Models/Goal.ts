import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Goal',
  table: 'goals',
  primaryKey: 'id',

  // SingleStore: small per-site config dimension replicated to every leaf as
  // a REFERENCE TABLE, so conversion joins against it need no reshuffle.
  tableKind: 'reference',

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'goals',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Site'],
  hasMany: ['Conversion'],

  indexes: [
    { name: 'goals_site', columns: ['site_id'] },
  ],

  attributes: {
    id: { fillable: true, validation: { rule: schema.string().required() } },
    site_id: { fillable: true, validation: { rule: schema.string().required() } },
    name: { fillable: true, validation: { rule: schema.string().required() } },
    type: { fillable: true, validation: { rule: schema.string().required() } },
    pattern: { fillable: true, validation: { rule: schema.string().optional() } },
    match_type: { fillable: true, validation: { rule: schema.string().optional() }, factory: () => 'exact' },
    duration_minutes: { fillable: true, validation: { rule: schema.number().optional() } },
    value: { fillable: true, validation: { rule: schema.number().optional() } },
    is_active: { fillable: true, validation: { rule: schema.boolean().optional() }, factory: () => true },
  },
})
