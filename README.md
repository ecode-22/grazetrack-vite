# GrazingTrack — Vite + React rewrite

This is now a **faithful port**, not just a scaffold — rebuilt directly
against your original `GrazeTrack-V2` source (`gt-map.js`, `gt-events.js`,
`gt-dashboard.js`, `gt-utils.js`, `gt-data.js`, `style.css`, `index.html`),
not reinvented from scratch. Where the two disagree, this README says so
explicitly.

## What's real (ported 1:1 from your source, not approximated)

- **Visuals**: `style.css` is copied wholesale from your repo — same
  light theme, same Inter font, same sidebar layout, same colours. Tailwind
  was removed; it was never part of the original and would have fought
  these styles.
- **Data model**: `Field`, `GrazingEvent`, `AnimalGroup` types match
  `gt-data.js` exactly (`areaHa`, `restTarget`, `maxAUperHa`, GeoJSON
  `geometry`, etc.) — not the invented shape from my first pass.
- **Storage**: separate local records for fields, grazing events, animal
  groups, and the farm profile. Signed-in records are namespaced by Django
  user; the first account sign-in carries existing device data into that
  account without exposing it to another user.
- **Status/readiness logic**: `getStatus()` / `getReadinessPct()` in
  `src/lib/status.ts` are line-for-line ports, including the exact CSS
  status classes (`grazing`/`ready`/`resting`/`danger`/`none`).
- **Area math**: `calcAreaHa()` in `src/lib/geo.ts` is the same spherical
  approximation formula as the original, not a Turf.js estimate.
- **Draw flow**: sidebar-driven Leaflet-Draw polygon tool (`Select`/`Draw`
  buttons arm/disarm a real `L.Control.Draw`, same shape options,
  dashed-while-drawing), name-the-field-after-drawing modal, same
  `Ctrl+Z`-simulated undo-last-vertex trick as the original.
- **Every modal**: Name field, Edit field (with the colour-swatch picker),
  Log Grazing Event (group-picker cards + manual entry + live stocking
  warning), Grazing History, Export/Backup, About, Animal Groups — all
  built from the actual markup/logic in `gt-map.js` / `gt-events.js` /
  `gt-dashboard.js`, using the real CSS class names throughout.
- **Dashboard**: KPI row, field-status grid, recent events table, stocking
  rates — ported from `renderDashboard()`.
- **Export/import**: JSON backup, GeoJSON fields, events CSV, import, clear
  all data — ported from `gt-dashboard.js`.

### One real bug fixed along the way
The original's "End Grazing" button has class `end-graze`, but its CSS rule
is `.end-graze-btn` — a typo that leaves the button unstyled in your live
app. Fixed here to `end-graze-btn` so it actually picks up the styling.

## What's still not ported (clearly out of scope for this pass)

These are large, self-contained subsystems in the original — porting them
faithfully is a project of its own, not a quick add-on:

| Feature | Original file | Status |
|---|---|---|
| Auto-split tool | `gt-split.js` | Not ported |
| Polygon reshape/edit | `gt-map.js` (edit toolbar) | Not ported — you can still edit a field's name/type/rest target/colour via the Edit modal, just not its shape |
| NDVI vegetation heatmap | `gt-map.js` | Not ported |
| Historical grazing-pressure heatmap | `gt-map.js` | Not ported |
| Rotation planner tab | `gt-dashboard.js` | Placeholder panel only |
| PDF reports | `gt-dashboard.js` (jsPDF) | Placeholder — use Export → Events CSV instead |
| Analytics tab / charts | `gt-analytics.js` | Placeholder panel only |
| Rainfall/weather | `gt-rain.js` | Not ported |
| First-run setup wizard | `setup.js` | Ported — choose one or multiple devices, then set farm name, animal groups, and device location |

The tab bar still shows Rotation/Reports/Analytics (so the navigation feels
the same) but each renders a clearly-labelled "not yet ported" placeholder
rather than silently doing nothing.

## Offline + sync architecture (unchanged from before, still correct)

- `src/lib/localStore.ts` is the only source of truth the UI reads from —
  every write is instant, synchronous `localStorage`, no network involved.
- `src/lib/sync.ts` debounces (2.5s) a push of the fields, events, animal
  groups, and farm profile to the Django API while online, and pulls-and-merges
  (last-write-wins by a local change timestamp) on reconnect.
- Django handles registration, login, and per-account API access. It stores
  password hashes and farm data in its own tables on Supabase PostgreSQL.
- Account settings show the signed-in email and farm, allow password changes,
  revoke other sessions after a password update, and provide sign-out.
- `vite-plugin-pwa` precaches the app shell and runtime-caches OpenStreetMap
  tiles, so the map and all data work with zero connectivity.
- The backend is only needed for accounts and multi-device sync; the app remains
  usable offline without it.

## Setup

```bash
npm install
cp .env.local.example .env.local
python -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
python backend/manage.py migrate
python backend/manage.py runserver
# In another terminal:
npm run dev
```

Set `DATABASE_URL` in `backend/.env` to the connection string from your Supabase
project's **Connect** dialog. Use a direct or session-pooler PostgreSQL URL with
SSL enabled. Django migrations create the account and farm-data tables in that
database; do not enable Supabase Auth or expose the database URL to the browser.
The frontend calls Django at `http://localhost:8000/api` by default. Set
`VITE_API_URL` in `.env.local` to change it. For deployment, set a strong
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, and
`CORS_ALLOWED_ORIGINS` for the deployed frontend and API domains.

`sql/schema.sql` documents that the database schema is managed by Django's
migrations, not applied manually in the Supabase SQL editor.

Existing Supabase Auth accounts are not imported automatically. Create a Django
account in the app before enabling sync; existing Supabase tables are left
untouched. Run backend checks with `backend/.venv/bin/python
backend/manage.py test farmdata.tests`.

## Notes

- Map tiles point at the public OpenStreetMap tile server — swap for
  whatever provider the original used if it wasn't OSM.
- PWA manifest icons (`/icons/icon-192.png`, `-512.png`) aren't included —
  drop your app icons into `public/icons/`.
- `npm run build` currently warns about a >500kB JS chunk (Leaflet +
  Leaflet-Draw and mapping code together). Harmless, but if it matters,
  the fix is code-splitting the map into a lazy `React.lazy()` import.
