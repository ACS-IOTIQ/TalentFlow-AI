# Assumptions

1. **Client is always Tahaluf** — The primary client for all JDs is Tahaluf. The `client` field defaults to "Tahaluf" and can be changed per JD.

2. **Currency is AED** — All salary and billing fields default to UAE Dirhams (AED). This is configurable per placement.

3. **AI runs locally by default, no API key needed** — `AI_PROVIDER=ollama` (the default) runs inference inside the Docker Compose stack itself via an `ollama` service, with zero external API cost or rate limits. Resume upload falls back to a basic candidate record if AI extraction fails. To use a cloud provider instead, set `AI_PROVIDER` to `anthropic` or `gemini` and provide the matching API key.

4. **Password reset is stubbed** — The forgot-password page shows a success message without sending an email (SMTP config is optional). In production, configure SMTP credentials in `.env`.

5. **MS Teams SSO is optional** — The application works with email/employee-ID + password auth. Teams SSO only activates when `MS_TENANT_ID` is set in `.env`.

6. **Candidate name inferred from filename** — When resumes are uploaded without email/name data, the candidate's name is inferred from the filename (`Rahul_Kumar_Resume.pdf` → "Rahul Kumar Resume"). HR should update names manually from the candidate detail page.

7. **Revenue module is Phase 2** — The placements and employee-cost billing module is scaffolded but stubbed in the UI. It activates once candidates reach the "Onboarded" stage and billing details are entered.

8. **Onboarding checklists are pre-defined** — The default checklist (Documents, Access, Induction) is static in the UI. Future: configurable per JD with database-backed items.

9. **Audit logs are internal** — Audit logs are stored in PostgreSQL but not yet exposed as a UI page. They are queryable directly from the database or Prisma Studio.

10. **Email notifications** — Notification emails (interview scheduled, submission approved) are not sent unless SMTP is configured. In-app notifications work without email.
