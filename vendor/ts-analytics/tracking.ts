// Vendored @stacksjs/ts-analytics/tracking — the dependency-free primitives,
// copied verbatim from the ts-analytics source (src/utils/*, zero imports) so
// the app is self-contained for deploy until the package is published to npm.
export { getBrowserFamily, isBot, type ParsedUserAgent, parseUserAgent } from './user-agent'
export { anonymizeIp, countryCodeOf, countryFlagEmoji, getCountryFromHeaders, getRegionFromHeaders, isSpamReferrer, parseReferrerSource } from './geolocation'
