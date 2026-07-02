# Known Limitations

## External service dependencies

| Feature | Limitation | Workaround |
|---------|-----------|------------|
| AI JD Polish | Requires configured `AI_PROVIDER` credentials | Set either `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in `.env`; without credentials the feature returns an error |
| AI Screening | Requires configured `AI_PROVIDER` credentials | Without credentials, manual screening notes can be added directly to pipeline entries |
| AI Resume Extraction | Requires configured `AI_PROVIDER` credentials for parsing | Upload still creates a fallback candidate record when AI extraction is unavailable |
| Email notifications | Requires SMTP credentials | In-app notifications work without SMTP |
| MS Teams SSO | Requires Azure App Registration | Email + Employee ID login works without Teams config |

## UI limitations

| Area | Limitation |
|------|-----------|
| Interview calendar | Shows list view; a full drag-and-drop calendar requires `react-big-calendar` integration (scaffolded but simplified for stability) |
| Revenue module | Phase 2 stub — billing tracking UI is a placeholder |
| Avatar upload | Backend storage is ready; frontend avatar upload UI is not yet built on the settings page |
| Global search | Search bar in topbar is not yet wired to a cross-entity search API |
| Command palette | Not yet implemented (planned with `cmdk`) |

## Infrastructure

| Area | Limitation |
|------|-----------|
| Horizontal scaling | The app is stateless but Redis sessions must be shared across instances; current Compose config is single-node only |
| File size limit | Next.js default request body limit is 4 MB; large ZIPs should be uploaded via direct MinIO presigned URL (not yet implemented) |
| PDF generation | Candidate profile PDF export is scaffolded but not yet wired to a download button |
