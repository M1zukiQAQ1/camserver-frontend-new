# CamServer Frontend

Nuxt frontend for the All Sky Cam gallery, live seeing monitor, and plate-solve detail tools.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The app uses a same-origin Nuxt proxy by default:

```text
Browser -> /api/** -> http://localhost:443/api/**
```

This matches the backend's `application-local.yml`, which listens on port `443` with SSL disabled.
Camera settings use `/api/settings`, which the proxy maps to Spring's legacy
`/settings` endpoint. Nuxt continues to serve `/api/_nuxt_icon/` itself.

## Backend Proxy Config

Defaults are ready for the local camera backend:

```bash
NUXT_BACKEND_API_BASE=http://localhost:443
NUXT_PUBLIC_API_BASE=/api
```

If you run the backend with the default TLS-enabled `application.yml`, set `NUXT_BACKEND_API_BASE=https://localhost:443`.

## Production

```bash
npm run build
npm run preview
```

For production behind a trusted reverse proxy, set `NUXT_BACKEND_API_BASE` to the backend origin and set `NUXT_BACKEND_TLS_VERIFY=true` once the backend has a trusted certificate.
