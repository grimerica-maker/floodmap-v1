# floodmap-v1

## Flood engine endpoint

The frontend reads flood tiles and elevation from `NEXT_PUBLIC_FLOOD_ENGINE_URL`.

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_FLOOD_ENGINE_URL=http://137.184.86.1:8000
```

Then fully stop and restart Next.js (`npm run dev`). Environment variables are only read at startup.

## Mixed-content safe mode

If the app is served over `https://` while the engine URL is `http://`, browsers block direct requests.

This app automatically falls back to the same-origin proxy route (`/api/engine`) in that case. Configure the proxy target with either:

- `FLOOD_ENGINE_BASE_URL` (server-side preferred), or
- `NEXT_PUBLIC_FLOOD_ENGINE_URL`.

The expected backend paths are:

- `/flood/{level}/{z}/{x}/{y}.png`
- `/elevation?lat=...&lng=...`
