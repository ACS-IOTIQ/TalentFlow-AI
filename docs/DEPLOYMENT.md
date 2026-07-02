# Deployment Guide

## Requirements

- Ubuntu 22.04 LTS (or any Docker-capable host)
- Docker Engine ≥ 24
- Docker Compose V2
- 4 GB RAM minimum (8 GB recommended)
- 20 GB disk (for PostgreSQL data + MinIO objects)

## Steps

### 1. Clone and configure

```bash
git clone <your-repo> acs-talentflow
cd acs-talentflow
cp .env.example .env
```

Edit `.env`:
- Set `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- Set `AI_PROVIDER` to `anthropic` or `gemini`
- Set `ANTHROPIC_API_KEY` from https://console.anthropic.com or `GEMINI_API_KEY` from Google AI Studio
- Change all default passwords (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD`)
- Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your domain

### 2. Build and start

```bash
docker compose up -d --build
```

This will:
1. Build the Next.js image
2. Start PostgreSQL, Redis, MinIO
3. Create MinIO buckets
4. Run Prisma migrations
5. Seed initial users
6. Start the app on port 3000

### 3. Verify

```bash
docker compose ps        # All services should be Up
docker compose logs app  # Check for startup errors
```

### 4. Set up reverse proxy (production)

Use Nginx or Caddy to proxy port 3000 with TLS:

**Caddyfile example:**
```
your-domain.com {
    reverse_proxy localhost:3000
}
```

### 5. Microsoft Teams SSO (optional)

1. Go to Azure Portal → App Registrations → New Registration
2. Set redirect URI: `https://your-domain.com/api/auth/callback/microsoft-entra-id`
3. Create a client secret
4. Add to `.env`:
   ```
   MS_TENANT_ID=your-tenant-id
   MS_CLIENT_ID=your-client-id
   MS_CLIENT_SECRET=your-secret
   ```
5. Restart: `docker compose restart app`

## Updating

```bash
git pull
docker compose up -d --build
```

Migrations run automatically on startup.

## Backup

```bash
# PostgreSQL
docker exec acs_postgres pg_dump -U talentflow talentflow > backup.sql

# MinIO (files)
docker run --rm -v $(pwd)/minio-backup:/backup \
  minio/mc mirror minio/talentflow-resumes /backup
```
