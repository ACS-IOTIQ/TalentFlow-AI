import nodemailer from 'nodemailer'
import { logger } from '@/lib/logger'

interface InterviewEmailDetails {
  candidateName: string
  candidateEmail?: string | null
  interviewerName: string
  interviewerEmail: string
  jdTitle: string
  client: string
  roundLabel: string
  scheduledAt: Date
  durationMinutes: number
  location?: string | null
  videoLink?: string | null
  assessmentUrl?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatInterviewDate(value: Date) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function createTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
  })
}

function interviewEmailHtml(details: InterviewEmailDetails, recipientType: 'candidate' | 'interviewer') {
  const title = recipientType === 'candidate' ? 'Your interview has been scheduled' : 'Interview scheduled for your assessment'
  const intro = recipientType === 'candidate'
    ? `Hi ${escapeHtml(details.candidateName)}, your interview for <strong>${escapeHtml(details.jdTitle)}</strong> has been scheduled.`
    : `Hi ${escapeHtml(details.interviewerName)}, you have been assigned to interview <strong>${escapeHtml(details.candidateName)}</strong> for <strong>${escapeHtml(details.jdTitle)}</strong>.`
  const actionUrl = recipientType === 'interviewer' ? details.assessmentUrl || details.videoLink : details.videoLink
  const actionLabel = recipientType === 'interviewer' ? 'Open Interview Assessment' : 'Join Interview'

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe3ef;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#4f46e5;padding:28px 32px;color:#ffffff;">
                <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.85;">TalentFlow AI</div>
                <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px;">
                <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#334155;">${intro}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                  ${[
                    ['Candidate', details.candidateName],
                    ['Role', `${details.jdTitle} - ${details.client}`],
                    ['Round', details.roundLabel],
                    ['Date & time', formatInterviewDate(details.scheduledAt)],
                    ['Duration', `${details.durationMinutes} minutes`],
                    ['Interviewer', `${details.interviewerName} (${details.interviewerEmail})`],
                    ['Location', details.location || 'Online'],
                    ['Video link', details.videoLink || 'To be shared'],
                  ].map(([label, value]) => `
                  <tr>
                    <td style="width:150px;padding:10px 12px;background:#f8fafc;border-radius:10px 0 0 10px;color:#64748b;font-size:13px;font-weight:700;">${escapeHtml(label)}</td>
                    <td style="padding:10px 12px;background:#f8fafc;border-radius:0 10px 10px 0;color:#0f172a;font-size:14px;">${escapeHtml(value)}</td>
                  </tr>`).join('')}
                </table>
                ${actionUrl ? `<div style="margin-top:26px;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:12px;">${actionLabel}</a></div>` : ''}
                <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#64748b;">Please keep this calendar slot available. If anything changes, contact the recruitment team.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function interviewEmailText(details: InterviewEmailDetails, recipientType: 'candidate' | 'interviewer') {
  const heading = recipientType === 'candidate'
    ? `Hi ${details.candidateName}, your interview has been scheduled.`
    : `Hi ${details.interviewerName}, you have been assigned to interview ${details.candidateName}.`
  return [
    heading,
    '',
    `Role: ${details.jdTitle} - ${details.client}`,
    `Round: ${details.roundLabel}`,
    `Date & time: ${formatInterviewDate(details.scheduledAt)}`,
    `Duration: ${details.durationMinutes} minutes`,
    `Interviewer: ${details.interviewerName} (${details.interviewerEmail})`,
    `Location: ${details.location || 'Online'}`,
    `Video link: ${details.videoLink || 'To be shared'}`,
    details.assessmentUrl ? `Assessment form: ${details.assessmentUrl}` : '',
  ].filter(Boolean).join('\n')
}

async function sendMail(to: string, subject: string, html: string, text: string) {
  const transport = createTransport()
  if (!transport) {
    logger.warn(`SMTP is not configured. Skipping email to ${to}`)
    return
  }

  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER
  const fromName = process.env.FROM_NAME || 'Talent Flow AI'

  await transport.sendMail({
    from: fromName && fromEmail ? `"${fromName}" <${fromEmail}>` : fromEmail,
    to,
    subject,
    html,
    text,
  })
}

export async function sendInterviewScheduledEmails(details: InterviewEmailDetails) {
  const subject = `Interview scheduled: ${details.jdTitle} - ${details.roundLabel}`
  const tasks = [
    details.candidateEmail
      ? sendMail(
        details.candidateEmail,
        subject,
        interviewEmailHtml(details, 'candidate'),
        interviewEmailText(details, 'candidate'),
      )
      : Promise.resolve(),
    sendMail(
      details.interviewerEmail,
      subject,
      interviewEmailHtml(details, 'interviewer'),
      interviewEmailText(details, 'interviewer'),
    ),
  ]

  const results = await Promise.allSettled(tasks)
  results.forEach((result) => {
    if (result.status === 'rejected') logger.error('Interview email failed', result.reason)
  })
}

export async function sendInterviewUpdatedEmails(details: InterviewEmailDetails, updateType: 'RESCHEDULED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED') {
  const label = updateType.replace(/_/g, ' ').toLowerCase()
  const subject = `Interview ${label}: ${details.jdTitle} - ${details.roundLabel}`
  const text = [
    `Interview ${label}`,
    '',
    interviewEmailText(details, 'candidate'),
  ].join('\n')
  const html = interviewEmailHtml(details, 'candidate').replace('Your interview has been scheduled', `Your interview has been ${label}`)
  const interviewerText = [
    `Interview ${label}`,
    '',
    interviewEmailText(details, 'interviewer'),
  ].join('\n')
  const interviewerHtml = interviewEmailHtml(details, 'interviewer').replace('Interview scheduled for your assessment', `Interview ${label}`)

  const tasks = [
    details.candidateEmail ? sendMail(details.candidateEmail, subject, html, text) : Promise.resolve(),
    sendMail(details.interviewerEmail, subject, interviewerHtml, interviewerText),
  ]
  const results = await Promise.allSettled(tasks)
  results.forEach((result) => {
    if (result.status === 'rejected') logger.error('Interview update email failed', result.reason)
  })
}
