// Site metadata + SEO. `buddy serve` loads this and injects accurate
// <title>, canonical, Open Graph, and Twitter card tags per page (replacing
// stx's "stx App" scaffold defaults). Per-path overrides live in `pages`.
const description = 'Privacy-first, cookieless web analytics. Real-time visitors, sources, and conversions with no cookies, no consent banner, and no personal data. Powered by Stacks and SingleStore.'

export default {
  name: 'ghostanalytics',
  url: 'https://ghostanalytics.org',
  description,
  seo: {
    siteName: 'ghostanalytics',
    title: 'ghostanalytics - Privacy-first web analytics',
    description,
    image: 'https://ghostanalytics.org/og.png',
    favicon: '/favicon.svg',
    locale: 'en_US',
    type: 'website',
    twitter: 'stacksjs',
  },
  pages: {
    '/': {
      title: 'ghostanalytics - Privacy-first web analytics',
      description,
    },
    '/dashboard': {
      title: 'Dashboard - ghostanalytics',
      description: 'Real-time visitors, page views, sessions, top pages, and traffic sources for your site.',
    },
  },
}
