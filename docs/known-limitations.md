# Known Limitations

## External service dependencies

| Feature | Limitation | Workaround |
|---------|-----------|------------|
| AI provider | Runs locally via Ollama by default (`AI_PROVIDER=ollama`, no API key/cost/rate limit) — Anthropic/Gemini remain available as an opt-in switch by setting `AI_PROVIDER` and the matching key | First boot pulls the model (a few minutes, one-time); the `app` container won't accept AI requests until `ollama-setup` finishes — see `docker-compose.yml` |
| Local AI hardware | The default model (`qwen2.5:1.5b-instruct`) is tuned for speed on modest CPUs; CPU inference is still categorically slower than a cloud API — observed real-world generation speed as low as ~5 tokens/sec on constrained hosts, meaning a full resume extraction can take several minutes (vs 1–5s for a cloud API); `OLLAMA_TIMEOUT_MS` defaults to 10 minutes to accommodate this | For better JSON-extraction reliability at the cost of speed, set `OLLAMA_MODEL=qwen2.5:3b-instruct` or `qwen2.5:7b-instruct` (needs progressively more RAM/CPU) — pure env-var change, no code change |
| Local AI + scanned documents | Ollama's local text models can't read inline PDF/DOCX bytes the way Gemini's multimodal API could — only affects resumes/JDs where local text extraction itself already failed (e.g. scanned/image-based files) | Falls back to a basic (non-AI) record automatically; fill in missing fields manually |
| AI Screening | "Run AI deep screening" only re-scores new/un-scored candidates by default | Check "Force full re-screen" to re-score everyone (e.g. after changing weights) |
| Internal Resources analyze | "Analyze" reuses a candidate's cached AI assessment for the same JD instead of re-calling AI every click | Check "Force full re-analyze" to bypass the cache and get fresh scores |
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
