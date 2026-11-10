/**
 * Runs before every request on Cloudflare Pages.
 * When CANONICAL_HOST is set (e.g. "trilemmai.com"), any other host (*.pages.dev deployment links, www.) gets a
 * permanent redirect to https://CANONICAL_HOST with the same path and query. Unset = no redirect, so the site keeps
 * working on pages.dev until the custom domain is live.
 */
export function onRequest({ request, env, next }) {
  const canonical = env.CANONICAL_HOST;
  const url = new URL(request.url);
  if (!canonical || url.hostname === canonical || url.hostname === 'localhost' || url.hostname === '127.0.0.1') return next();
  return Response.redirect(`https://${canonical}${url.pathname}${url.search}`, 301);
}
