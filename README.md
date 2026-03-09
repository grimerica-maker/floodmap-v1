# floodmap-v1

## Flood engine endpoint

The frontend reads flood tiles and elevation from:

- `NEXT_PUBLIC_FLOOD_ENGINE_URL` (default: `http://127.0.0.1:8000`)

Set it when starting Next.js if your engine is on a different host/port:

```bash
NEXT_PUBLIC_FLOOD_ENGINE_URL=http://your-engine-host:8000 npm run dev
```

The expected backend paths are:

- `/flood/{level}/{z}/{x}/{y}.png`
- `/elevation?lat=...&lng=...`
