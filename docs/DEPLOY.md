# Deploying on the Unraid server

The app runs as one Docker container beside `medicare-crm`, on host port **3001**.
Reach it at `http://frascahomeserver.taila1ca37.ts.net:3001` from any device with
Tailscale, or at `http://<LAN IP>:3001` at home (add that `host:port` to
`ALLOWED_ORIGINS` in `docker.env` first, or saves will silently fail from it).

## First install (Unraid web terminal)

```bash
mkdir -p /mnt/user/compose && cd /mnt/user/compose \
  && git clone https://github.com/cfrasca15/mind-game-athletes.git \
  && cd mind-game-athletes
```

Then create `docker.env` from `docker.env.example` with a real `SESSION_SECRET`
(`openssl rand -hex 32`) and the `ALLOWED_ORIGINS` above. Long pastes into the
Unraid terminal can corrupt characters; the safe way is to base64-encode the
file elsewhere and `echo '<blob>' | base64 -d > docker.env`. Verify with
`grep -c '•' docker.env` (must print 0). Then:

```bash
docker compose up -d --build
```

Open the URL above; the first visit goes to `/setup` to create the login.

## Updating

```bash
cd /mnt/user/compose/mind-game-athletes && git pull && docker compose up -d --build
```

Migrations run automatically on start. The database lives in the `mga-data`
volume and survives rebuilds.

## Backup

```bash
docker cp mind-game-athletes:/app/data/prod.db /mnt/user/backups/mga-$(date +%F).db
```

(`scripts/unraid/crm-backup.sh` in medicare-crm shows the encrypted, nightly,
Google Drive variant if you want the same here.)
