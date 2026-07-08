/**
 * Route Registry
 *
 * The key becomes the URL prefix; an explicit `prefix: ''` mounts a route
 * file at the root. We spread the framework defaults (`api`, `v1`) and add
 * the ghostanalytics ingest + stats API, whose paths are already absolute
 * (`/collect`, `/health`, `/script.js`, `/api/sites/*`) so it mounts at root.
 *
 * @see https://docs.stacksjs.org/routing
 */
import type { RouteRegistry } from '@stacksjs/router'
import defaults from '../storage/framework/defaults/app/Routes'

export type { RouteDefinition, RouteRegistry } from '@stacksjs/router'

export default {
  ...defaults,
  analytics: { path: 'analytics', prefix: '' },
} satisfies RouteRegistry
