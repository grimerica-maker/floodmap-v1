# floodmap-v1

## Local flood tile backend

The app proxies flood engine requests through Next.js at:

- `/api/engine/*`

This avoids browser CORS issues and makes tile + elevation requests same-origin.

By default, the proxy forwards to:

- `http://127.0.0.1:8000`

Override backend target with:

```bash
FLOOD_ENGINE_BASE_URL=http://your-engine-host:8000
```

Then start Next.js as usual (`npm run dev`).
