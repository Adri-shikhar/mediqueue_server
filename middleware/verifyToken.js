const { createRemoteJWKSet, jwtVerify } = require('jose-cjs')

function buildIssuerJwksMap() {
  const raw =
    process.env.BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_ISSUER ||
    'http://localhost:3000'

  const issuers = raw
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)

  const jwksByIssuer = new Map()

  for (const issuer of issuers) {
    const jwksUrl = new URL('/api/auth/jwks', `${issuer}/`)
    jwksByIssuer.set(issuer, createRemoteJWKSet(jwksUrl))
  }

  return jwksByIssuer
}

const jwksByIssuer = buildIssuerJwksMap()

const verifyToken = async (req, res, next) => {
  const header = req?.headers?.authorization
  const token = header?.split(' ')[1]

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' })
  }

  try {
    let payload

    for (const [issuer, jwks] of jwksByIssuer) {
      try {
        ;({ payload } = await jwtVerify(token, jwks, {
          issuer,
          audience: issuer,
        }))
        break
      } catch {
        /* try next origin */
      }
    }

    if (!payload) {
      return res.status(401).send({ message: 'Unauthorized' })
    }

    req.user = payload
    next()
  } catch {
    return res.status(401).send({ message: 'Unauthorized' })
  }
}

module.exports = { verifyToken, jwksByIssuer }
