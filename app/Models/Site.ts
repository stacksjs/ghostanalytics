import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Site',
  table: 'sites',
  primaryKey: 'id',

  // SingleStore: small tenant dimension replicated to every leaf as a
  // REFERENCE TABLE, so it joins against the sharded fact tables without a
  // reshuffle. Keeps the id primary key + unique semantics.
  tableKind: 'reference',

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'sites',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  hasMany: ['Session', 'PageView', 'CustomEvent', 'Goal'],

  attributes: {
    id: {
      fillable: true,
      validation: { rule: schema.string().required() },
    },

    name: {
      fillable: true,
      validation: { rule: schema.string().required().max(255) },
    },

    domains: {
      fillable: true,
      validation: { rule: schema.string().optional() },
      factory: () => '[]',
    },

    timezone: {
      fillable: true,
      validation: { rule: schema.string().optional() },
      factory: () => 'UTC',
    },

    is_active: {
      fillable: true,
      validation: { rule: schema.boolean().optional() },
      factory: () => true,
    },

    owner_id: {
      fillable: true,
      validation: { rule: schema.number().optional() },
    },

    settings: {
      fillable: true,
      validation: { rule: schema.string().optional() },
      factory: () => '{}',
    },
  },
})
