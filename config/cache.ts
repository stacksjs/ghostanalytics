import type { CacheConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Cache Configuration**
 *
 * ghostanalytics caches on **SingleStore** rather than Redis. Following
 * Fathom's architecture (they dropped Redis entirely once SingleStore was in
 * place — it has plenty of free RAM and the app already talks to it), the cache
 * lives in the same cluster as the analytics data, so there's one fewer service
 * to run, pay for, and keep available.
 */
export default {
  /**
   * The cache driver to use ('memory' | 'redis' | 'singlestore')
   */
  driver: env.CACHE_DRIVER || 'singlestore',

  /**
   * Key prefix for cache namespacing
   */
  prefix: 'stacks',

  /**
   * Default TTL in seconds (0 = no expiration)
   */
  ttl: 3600,

  /**
   * Maximum number of keys (-1 = unlimited)
   */
  maxKeys: -1,

  /**
   * Clone values on get/set (disable for better performance with immutable data)
   */
  useClones: true,

  drivers: {
    /**
     * Memory driver configuration
     */
    memory: {
      maxKeys: -1,
      checkPeriod: 600,
      deleteOnExpire: true,
    },

    /**
     * Redis driver configuration
     */
    redis: {
      host: '127.0.0.1',
      port: 6379,
      username: '',
      password: '',
      database: 0,
      tls: false,
    },

    /**
     * SingleStore driver configuration
     *
     * Persists cache entries in a SingleStore rowstore table (MySQL wire
     * protocol, port 3306). Set `ssl: true` for managed SingleStore (Helios).
     */
    singlestore: {
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      database: env.DB_DATABASE || 'ghostanalytics',
      table: 'ghostanalytics_cache',
      ssl: (env as Record<string, string | undefined>).DB_SSL === 'true',
    },
  },
} satisfies CacheConfig
