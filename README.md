# Mind Game Athletes CRM

Single-user CRM for a mental-performance coach working with youth soccer players and teams.

- **Players** with parents/guardians, intake details, goals, session history.
- **Teams** that players can belong to, with their own sessions and billing.
- **Packages**: a catalog of single sessions, multi-packs and team programs. Buying one for a player creates a pack; completing a session uses one up.
- **Sessions**: schedule, write a plan beforehand, notes afterwards, and a "focus for next time" that is pulled forward into the next session's plan.
- **Payments**: record payments against packs or single sessions; balances are computed per player/team.
- **Google Calendar** (optional): sessions booked here are mirrored one-way onto a Google Calendar. Setup is in [docs/GOOGLE-CALENDAR.md](docs/GOOGLE-CALENDAR.md).

Stack: Next.js 16 (App Router, Server Actions), Prisma 7 on SQLite, Tailwind 4. Same shape as `medicare-crm`.

## Local development

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000. The first visit goes to `/setup` to create the one login. `.env.local` holds the dev config.

## Deploy with Docker

```bash
cp docker.env.example docker.env   # then fill in SESSION_SECRET and ALLOWED_ORIGINS
docker compose up -d --build
```

The app listens on port **3001** on the host (see `docker-compose.yml`). The SQLite database lives in the `mga-data` volume at `/app/data/prod.db`. Migrations run automatically on container start.

`ALLOWED_ORIGINS` must list every `host:port` the app is reached through (Tailscale name, LAN IP…). If a host is missing, forms silently do nothing from that address.

### Backups

The whole state is one file. From the server:

```bash
docker cp mind-game-athletes:/app/data/prod.db ./mga-backup-$(date +%F).db
```

## Schema changes

Edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <what-changed>`. Commit the generated migration folder; the container applies it on next start.
