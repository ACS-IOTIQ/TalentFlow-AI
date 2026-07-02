const baseUrl = process.env.APP_URL || 'http://localhost:3000'
const email = process.env.TEST_EMAIL || 'ashutosh@acstechnologies.com'
const password = process.env.TEST_PASSWORD || 'Admin@123'
const shouldCreate = process.env.CREATE_INTERVIEW === 'true'

const cookieJar = new Map()

function storeCookies(response) {
  const cookies = response.headers.getSetCookie?.() || []
  for (const cookie of cookies) {
    const [pair] = cookie.split(';')
    const [name, value] = pair.split('=')
    cookieJar.set(name, value)
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
    headers: {
      ...(cookieJar.size ? { cookie: cookieHeader() } : {}),
      ...(options.headers || {}),
    },
  })
  storeCookies(response)
  return response
}

async function json(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Expected JSON from ${response.url}; got ${response.status}: ${text.slice(0, 200)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const csrfResponse = await request('/api/auth/csrf')
assert(csrfResponse.ok, `CSRF failed: ${csrfResponse.status}`)
const csrf = await json(csrfResponse)
assert(csrf.csrfToken, 'Missing CSRF token')

const loginBody = new URLSearchParams({
  csrfToken: csrf.csrfToken,
  email,
  password,
  callbackUrl: `${baseUrl}/dashboard`,
  json: 'true',
})

const loginResponse = await request('/api/auth/callback/credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: loginBody,
})
assert([200, 302].includes(loginResponse.status), `Login failed: ${loginResponse.status}`)

const optionsResponse = await request('/api/interviews?options=true')
assert(optionsResponse.ok, `Interview options failed: ${optionsResponse.status}`)
const options = await json(optionsResponse)
assert(options.success, options.error || 'Interview options returned success=false')
assert(Array.isArray(options.data.entries), 'Interview options did not return entries array')

console.log(`Interview options OK: ${options.data.entries.length} schedulable entries`)

if (shouldCreate && options.data.entries.length) {
  const entry = options.data.entries[0]
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  scheduledAt.setMinutes(0, 0, 0)

  const createResponse = await request('/api/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pipelineEntryId: entry.id,
      roundNumber: 1,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: 60,
      location: 'API smoke test',
      videoLink: 'https://meet.example.com/talentflow-smoke-test',
    }),
  })
  const created = await json(createResponse)
  assert(createResponse.status === 201, `Interview create failed: ${createResponse.status} ${JSON.stringify(created)}`)
  assert(created.success && created.data.id, created.error || 'Interview create returned no id')
  console.log(`Interview create OK: ${created.data.id}`)
}

const listResponse = await request('/api/interviews?pageSize=10')
assert(listResponse.ok, `Interview list failed: ${listResponse.status}`)
const list = await json(listResponse)
assert(list.success && Array.isArray(list.data), list.error || 'Interview list returned invalid response')
console.log(`Interview list OK: ${list.data.length} rows`)
