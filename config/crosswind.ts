/**
 * Crosswind (utility CSS) — content globs for STX views.
 * @see https://github.com/cwcss/crosswind
 */
export default {
  content: [
    './resources/views/**/*.{stx,html}',
    './resources/**/*.{stx,html}',
    // Framework defaults now resolve from the published @stacksjs/defaults package
    // (framework-as-dependencies) rather than the vendored storage/framework/ tree.
    // The error-page views moved under defaults/resources/views/errors, so the
    // views glob below covers them too.
    './node_modules/@stacksjs/defaults/resources/views/**/*.{stx,html}',
    './node_modules/@stacksjs/defaults/resources/components/**/*.{stx,html}',
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
        'text': 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        'accent': 'var(--accent)',
        'bar': 'var(--bar)',
      },
    },
  },
}
