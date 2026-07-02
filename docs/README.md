# TalentFlow AI — ACS Technologies

AI-powered recruitment pipeline management for the Tahaluf engagement.

## Quick start

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Set AI_PROVIDER plus either ANTHROPIC_API_KEY or GEMINI_API_KEY in .env
# 3. Optionally set MS Teams SSO credentials

# 4. Start everything
docker compose up -d --build
```

The application will be available at **http://localhost:3000**

## Default credentials

| Name | Email | Password | Role |
|------|-------|----------|------|
| Ashutosh Jha | ashutosh@acstechnologies.com | Admin@123 | Super Admin / CSO |
| Raj Shekhar Perepa | raj@acstechnologies.com | Admin@123 | Director Tech |
| Harsha | harsha@acstechnologies.com | Admin@123 | HR |
| Suprriya | suprriya@acstechnologies.com | Admin@123 | HR |

You can also log in with Employee ID (`EMP001`, `EMP002`, etc.) instead of email.

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| App | http://localhost:3000 | TalentFlow AI |
| MinIO | http://localhost:9001 | File storage console |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Sessions / queue |

## Features

- **AI JD polishing** — Paste raw JD; the configured AI provider polishes it into a structured posting
- **Bulk resume upload** — PDF, DOCX, or ZIP of resumes; AI extracts skills and scores candidates
- **AI screening** — Configurable weight sliders for skill / availability / location scoring
- **Pipeline management** — Kanban + list view through 11 stages
- **Internal resource diversion** — ACS employees entered directly into Tahaluf pipeline
- **Interview scheduling** — Multi-round support with calendar view
- **Submission tracking** — Tahaluf feedback loop (approved / rejected)
- **Onboarding checklists** — Post-approval candidate onboarding tracking
- **Dark mode** — Full light/dark theme support
- **RBAC** — Five roles with route-level and UI-level enforcement

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
