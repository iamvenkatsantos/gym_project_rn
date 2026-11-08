# api.vinven.net proxy

`worker.js` is the Cloudflare Worker `corefit-api` behind `https://api.vinven.net`, the app's and
dashboard's Supabase URL. It is pasted into Cloudflare by hand (Workers & Pages → corefit-api →
Edit code → Deploy). It forwards only `/auth/v1/`, `/rest/v1/`, `/storage/v1/`, `/functions/v1/` and
`/realtime/v1/`; everything else is a 404.

## Rate limit (Cloudflare dashboard, once)

Slows down password guessing and code guessing from one address. Security → WAF → Rate limiting
rules → Create rule (the free plan allows one):

- **If incoming requests match** (Edit expression):

  ```
  (http.host eq "api.vinven.net" and http.request.method eq "POST" and http.request.uri.path in {"/auth/v1/token" "/auth/v1/otp" "/auth/v1/verify" "/auth/v1/recover" "/auth/v1/signup" "/functions/v1/accept-invite" "/functions/v1/reset-password"})
  ```

- **With the same characteristics:** IP
- **When rate exceeds:** 10 requests per 10 seconds
- **Then take action:** Block, for 10 seconds

`/auth/v1/token` also refreshes sessions, about once an hour per phone, so 10 per 10 seconds never
touches normal use. Supabase's own Auth rate limits (Authentication → Rate Limits) still apply on top.
