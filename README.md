# CaptainHook

CaptainHook is a small personal task app with a FastAPI backend and a Next.js frontend. It is built for lightweight daily routines, reminders, and plugin-based task generation.

## Docker Setup

Requirements:

- Docker
- `docker-compose` or Docker Compose plugin

No custom variables are required for the app to start.

The only optional variables in `docker-compose.yml` are for web push notifications. If you do not need browser push, you can skip them entirely.

If you want push notifications, generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

Then create a root `.env` file:

```env
WEB_PUSH_VAPID_PUBLIC_KEY=your_public_key
WEB_PUSH_VAPID_PRIVATE_KEY=your_private_key
WEB_PUSH_VAPID_CLAIMS_SUBJECT=mailto:you@example.com
```

From the repo root, run:

```bash
docker-compose up --build
```

If your machine uses the newer Compose plugin, use:

```bash
docker compose up --build
```

The app will be available at:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

To run in the background:

```bash
docker-compose up --build -d
```

To stop everything:

```bash
docker-compose down
```

The SQLite database is stored in a Docker volume, so your data stays available across container restarts.
