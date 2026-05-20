/**
 * Smoke test: protected route rejects bad/missing JWT; accepts valid Better Auth JWT.
 * Usage: JWT=<token> node scripts/test-jwt.js
 */
const base = process.env.API_URL || 'http://localhost:8000'
const token = process.env.JWT

async function check(label, url, options = {}) {
  const res = await fetch(url, options)
  const body = await res.text()
  console.log(`${label}: ${res.status}`, body.slice(0, 120))
  return res.status
}

async function main() {
  await check('GET /bookings (no token)', `${base}/bookings`)
  await check('GET /tutors (public)', `${base}/tutors?limit=1`)
  await check('GET /bookings (bad token)', `${base}/bookings`, {
    headers: { Authorization: 'Bearer not-a-jwt' },
  })

  if (!token) {
    console.log('Skip valid-token test — set JWT env from Better Auth /api/auth/token')
    return
  }

  await check('GET /auth/me (valid token)', `${base}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
