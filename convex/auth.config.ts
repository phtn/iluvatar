const config = {
  providers: [
    {
      // Trust tokens issued by this Convex deployment's auth routes.
      // The issuer is `CONVEX_SITE_URL` and the JWKS is served from:
      // `/.well-known/jwks.json` via `auth.addHttpRoutes(http)` in `convex/http.ts`.
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex'
    }
  ]
}

export default config

