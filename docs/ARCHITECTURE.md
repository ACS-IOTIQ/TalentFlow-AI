# Architecture Overview

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui (Radix UI) |
| State | TanStack Query (server), Zustand (client) |
| Auth | NextAuth v5, JWT sessions |
| ORM | Prisma 5, PostgreSQL 15 |
| Cache/Queue | Redis 7 (ioredis, bull) |
| File Storage | MinIO (S3-compatible) |
| AI | Configurable Anthropic Claude or Google Gemini via `src/lib/ai/provider.ts` |
| Container | Docker, Docker Compose |

## Directory structure

```
src/
├── app/
│   ├── (app)/          # Authenticated routes (sidebar layout)
│   │   ├── dashboard/
│   │   ├── candidates/
│   │   ├── jds/
│   │   ├── screening/
│   │   ├── interviews/
│   │   ├── submissions/
│   │   ├── onboarding/
│   │   ├── internal-resources/
│   │   ├── pipeline/
│   │   ├── users/
│   │   ├── revenue/
│   │   └── settings/
│   ├── api/            # API route handlers
│   └── login/          # Public auth pages
├── components/
│   └── layout/         # Sidebar, Topbar
├── lib/
│   ├── ai/             # AI provider, resume extraction, JD polish, screening
│   ├── auth/           # NextAuth config
│   ├── db.ts           # Prisma singleton
│   ├── storage.ts      # MinIO/S3 client
│   └── resume-parser.ts
└── types/              # TypeScript extensions
```

## Data flow

1. **Resume upload** → POST /api/candidates → extract text → configured AI parser → MinIO → DB
2. **AI screening** → POST /api/screening?action=run → fetch entries → configured AI provider → scores + flags written to DB
3. **JD polish** → POST /api/jds/[id]/polish → raw content → configured AI provider → polished content written
4. **Submission** → POST /api/submissions → pipeline entry updated → Tahaluf notified
5. **Auth** → NextAuth credentials or MS SSO → JWT in secure httpOnly cookie → middleware RBAC

## RBAC

| Role | Dashboard | JDs | Candidates | Screening | Interviews | Submissions | Users | Revenue |
|------|-----------|-----|-----------|-----------|------------|-------------|-------|---------|
| SUPER_ADMIN | ✓ | ✓ RW | ✓ RW | ✓ | ✓ | ✓ | ✓ | ✓ |
| CSO | ✓ | ✓ RW | ✓ RW | ✓ | ✓ | ✓ | ✓ | ✓ |
| DIR_TECH | ✓ | ✓ RW | ✓ R | ✓ | ✓ | ✓ | — | — |
| HR | ✓ | ✓ R | ✓ RW | ✓ R | ✓ | — | — | — |
| CMD | ✓ | — | — | — | — | — | — | ✓ R |
