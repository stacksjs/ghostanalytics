import { route } from '@stacksjs/router'

/**
 * Auth endpoints, re-registered at the root with `.skipCsrf()`.
 *
 * These use the framework's default Auth actions (resolved by string), but the
 * defaults are CSRF-gated — which blocks the same-origin `fetch()` from the
 * login/register pages. Token auth is CSRF-immune (bearer tokens aren't sent
 * automatically by the browser the way cookies are), so skipping CSRF here is
 * safe; the rate limits are kept. User route files load before the framework
 * defaults, so these win on the duplicate method+path.
 */
route.post('/login', 'Actions/Auth/LoginAction').skipCsrf().rateLimit(5, 'minute')
route.post('/register', 'Actions/Auth/RegisterAction').skipCsrf().rateLimit(3, 'minute')
route.post('/logout', 'Actions/Auth/LogoutAction').skipCsrf()

// GET API endpoints must sit under /api/** — the view process only reverse
// proxies non-GET requests and the /api/** prefix through to this API process.
// A bare GET like /me would be swallowed by the view server's page routing.
route.get('/api/me', 'Actions/MeAction').skipCsrf()

// Social sign-in (GitHub, Google) via the native @stacksjs/socials drivers.
// Under /api/** so the GET redirect + provider callback reach this process.
route.get('/api/auth/{provider}/redirect', 'Actions/Auth/SocialRedirectAction').skipCsrf()
route.get('/api/auth/{provider}/callback', 'Actions/Auth/SocialCallbackAction').skipCsrf()

// Billing (Stripe). Checkout requires an authenticated user (bearer token);
// the webhook is a Stripe callback so it skips CSRF and auth.
route.post('/payments/checkout', 'Actions/Payment/CreateCheckoutAction').middleware('auth').skipCsrf()
route.post('/webhooks/stripe', 'Actions/StripeWebhook').skipCsrf()
