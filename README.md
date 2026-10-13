# Siletry frontend

React 18 + Vite + TypeScript. Talks to the Siletry backend.

## Run locally

```bash
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8080
npm run dev                 # http://localhost:5173
```

While the backend runs with `WHATSAPP_PROVIDER=mock`, WhatsApp codes are shown on screen ("Test mode") instead of being sent.

Log in with the demo clinic from the backend seed: `demo@siletry.com` / `demo1234`
(receptionist: `desk@siletry.com` / `demo1234`).

## Deploy on Railway

1. New service from this repo. It builds with the `Dockerfile` (nginx serving the built app).
2. Variables:
   ```
   VITE_API_URL=https://<your-backend>.up.railway.app
   ```
   `VITE_*` values are baked in at build time, so redeploy after changing them.
3. In the **backend** service, add this frontend's URL to `ALLOWED_ORIGINS`, otherwise the browser blocks API calls (CORS).

To serve under a sub-path like `siletry.com/app`, set `VITE_BASE_PATH=/app/`.

## Screens

| Route | Screen |
|---|---|
| `/login` | Sign in with password (email or mobile) or a WhatsApp code |
| `/signup` | New clinic: details, then verify with a WhatsApp code |
| `/setup` | 5-step clinic setup: clinic, doctors & hours, WhatsApp number, automations, go live |
| `/` | Overview |
| `/appointments` | Appointments with tabs, filters, lobby queue (Call next, walk-ins), announce delay, book / reschedule / cancel |
| `/inbox`, `/inbox/:id` | Inbox: Needs you / All, thread, take over / hand back, reply, patient side panel |
| `/patients`, `/patients/:id` | Patients list, patient profile, follow-ups |
| `/doctors` | Doctors & availability: weekly hours, leave, booking rules, add/edit doctor |
| `/booking-flow` | QR codes (book / check in), download PNGs, copy wa.me links |
| `/templates` | WhatsApp message templates |
| `/whatsapp` | Clinic number, message usage vs monthly cap |
| `/automations` | Reminders, queue updates, follow-ups, bot on/off |
| `/reports`, `/billing`, `/settings` | Reports, plan, clinic details and team |
| `/simulator` | Test the WhatsApp experience as a patient or doctor (backend must be in mock mode) |

## Code layout

```
src/api/        client.ts (fetch + JWT), types.ts (mirrors backend DTOs)
src/lib/        auth, toasts, useFetch hook, formatting
src/components/ Layout (sidebar/topbar/search), BookVisitModal, QueuePanel, UI primitives
src/pages/      one file per screen
src/styles.css  design tokens and all styles
```
