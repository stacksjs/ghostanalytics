/**
 * Crosswind (utility CSS) — content globs for STX views.
 * @see https://github.com/cwcss/crosswind
 */
export default {
  content: [
    './resources/views/**/*.{stx,html}',
    './resources/**/*.{stx,html}',
    './storage/framework/defaults/resources/views/**/*.{stx,html}',
    './storage/framework/defaults/resources/components/**/*.{stx,html}',
    './storage/framework/core/error-handling/src/views/**/*.{stx,html}',
  ],
  preflight: true,
  minify: false,
  // Register the design tokens (defined as CSS vars in each view's :root, so they
  // stay theme-reactive for light/dark) so utilities like `text-text-2`,
  // `bg-panel`, `border-border` exist — replacing repetitive inline
  // `style="color: var(--text-2)"` etc. with crosswind classes.
  theme: {
    extend: {
      colors: {
        'bg': 'var(--bg)',
        'panel': 'var(--panel)',
        'border': 'var(--border)',
        // NB: `text` and `accent` as color keys don't resolve in crosswind
        // (`text` collides with the text-* prefix); use `fg` / `brand` instead.
        'fg': 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        'brand': 'var(--accent)',
        'bar': 'var(--bar)',
      },
    },
  },
}
