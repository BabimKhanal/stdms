# Nucleus web workspace

Run from the repository root:

```powershell
npm run dev
```

This starts both the web app (`http://localhost:3000`) and API
(`http://localhost:4000`). PostgreSQL and Redis must also be running; follow the
root README for database setup. To start only the API:

```powershell
npm run dev -w @edu/api
```

## API connection

By default the browser calls `/api/v1` on the same origin as the web app. Next.js
forwards those requests to `http://127.0.0.1:4000/api/v1`. The API still validates
authentication and permissions; the web page-login redirect excludes API paths
so unauthenticated login requests can reach the backend.

For another upstream, set this in `apps/web/.env.local` or the web deployment's
environment and restart/rebuild the web app:

```dotenv
API_URL=https://your-api.example.edu/api/v1
```

`API_URL` is server-only. This avoids browser CORS and mixed-content failures for
normal web API requests. For deployments, use a URL reachable from the web server,
not the browser user's machine.

`NEXT_PUBLIC_API_URL` is an optional direct-browser override, baked into the
JavaScript at build time. Use it only when the API is publicly reachable and its
`WEB_ORIGIN` permits the exact web origin. Do not point a deployed browser at
`localhost`. If previously configured and switching to the same-origin proxy,
remove the override and restart/rebuild the web app.

## Troubleshooting sign-in

- **School service unavailable:** check the API is running and `API_URL` is correct.
  Connection failures do not indicate an incorrect password.
- **Invalid credentials:** the API was reached and rejected the supplied login.
- **Unexpected response:** inspect the upstream URL and gateway availability;
  the client expects the API's JSON response, not an HTML login page.

From the web origin, `GET /api/v1/auth/me` without credentials should return a JSON
401 response, not redirect to `/login`. This verifies proxy routing without
attempting a login or changing any password.

The notification WebSocket currently connects directly to the configured public
API (or port 4000 locally); hosting it behind the web origin requires separate
WebSocket proxy support.

## Build while development is running

Use a separate output directory so a verification build does not overwrite the
files used by the live development server:

```powershell
$env:NEXT_DIST_DIR = ".next-check"
npm run build -w @edu/web
Remove-Item Env:NEXT_DIST_DIR
```

Normal builds and deployments continue to use `.next` when this variable is unset.
