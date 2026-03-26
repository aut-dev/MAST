/**
 * MAST Coinbase Onramp Session Token API
 *
 * Cloudflare Worker that generates authenticated Coinbase Onramp session tokens.
 * Handles CORS, API key authentication, JWT signing with Ed25519, and rate limiting.
 *
 * Required secrets (set via `wrangler secret put`):
 *   MAST_API_KEY       - Bearer token for authenticating callers
 *   CDP_API_KEY_ID     - Coinbase Developer Platform API key ID
 *   CDP_API_KEY_SECRET - Coinbase Developer Platform API key secret (base64-encoded)
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://aut-dev.github.io',
  // Add additional allowed origins here:
  // 'https://example.com',
];

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;           // max requests per window per IP

const COINBASE_ONRAMP_URL = 'https://api.developer.coinbase.com/onramp/v1/token';

// PKCS8 DER prefix for Ed25519 (RFC 8410 Section 10.3)
// SEQUENCE(46) INTEGER(0) SEQUENCE(OID 1.3.101.112) OCTET_STRING(34) OCTET_STRING(32)
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, resets on worker restart / new isolate)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map(); // ip -> { count, resetAt }

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);

  return entry.count > RATE_LIMIT_MAX;
}

// Periodically prune stale entries to prevent memory growth
function pruneRateLimitMap() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function errorResponse(message, status) {
  return jsonResponse({ error: message }, status);
}

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function withCors(response, request) {
  const corsHeaders = getCorsHeaders(request);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Base64 / Base64URL utilities (no Buffer in Workers)
// ---------------------------------------------------------------------------

function base64Decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(data) {
  let bytes;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  }

  // Convert to base64 via binary string
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);

  // Convert to base64url
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Ed25519 JWT signing for Coinbase CDP
// ---------------------------------------------------------------------------

/**
 * Build a PKCS8 DER-encoded buffer from a raw 32-byte Ed25519 seed.
 * Cloudflare Workers do not support raw private key import for Ed25519,
 * so we wrap the seed in the standard PKCS8 ASN.1 structure per RFC 8410.
 */
function buildPkcs8FromSeed(seed) {
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + seed.length);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed, ED25519_PKCS8_PREFIX.length);
  return pkcs8;
}

/**
 * Import the CDP API key secret (base64-encoded, 64 bytes: 32-byte seed + 32-byte pubkey)
 * as a CryptoKey suitable for signing.
 */
async function importEdKey(apiKeySecretB64) {
  const decoded = base64Decode(apiKeySecretB64);
  if (decoded.length < 32) {
    throw new Error('CDP API key secret is too short');
  }
  const seed = decoded.slice(0, 32);
  const pkcs8 = buildPkcs8FromSeed(seed);

  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8.buffer,
    { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
    false,
    ['sign'],
  );
}

/**
 * Generate a signed JWT for authenticating with the Coinbase CDP API.
 */
async function generateCdpJwt(keyId, apiKeySecretB64) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'EdDSA',
    kid: keyId,
    nonce: randomHex(16),
    typ: 'JWT',
  };

  const payload = {
    sub: keyId,
    iss: 'cdp',
    aud: ['cdp_service'],
    nbf: now,
    exp: now + 120,
    uri: 'POST api.developer.coinbase.com/onramp/v1/token',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const key = await importEdKey(apiKeySecretB64);
  const signature = await crypto.subtle.sign(
    'NODE-ED25519',
    key,
    new TextEncoder().encode(message),
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${message}.${encodedSignature}`;
}

// ---------------------------------------------------------------------------
// Coinbase Onramp token request
// ---------------------------------------------------------------------------

async function fetchOnrampToken(jwt, address) {
  const body = {
    addresses: [{ address, blockchains: ['base'] }],
    assets: ['USDC'],
  };

  const response = await fetch(COINBASE_ONRAMP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Coinbase API error:', response.status, text);
    throw new Error(`Coinbase API returned ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(request, env) {
  // --- Preflight ---
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }), request);
  }

  // --- Method check ---
  if (request.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405), request);
  }

  // --- Rate limiting ---
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  pruneRateLimitMap();
  if (isRateLimited(clientIp)) {
    return withCors(errorResponse('Too many requests. Try again later.', 429), request);
  }

  // --- Authentication ---
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return withCors(errorResponse('Missing or malformed Authorization header', 401), request);
  }

  const providedKey = match[1];
  if (!env.MAST_API_KEY || providedKey !== env.MAST_API_KEY) {
    return withCors(errorResponse('Invalid API key', 403), request);
  }

  // --- Parse body ---
  let body;
  try {
    body = await request.json();
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400), request);
  }

  const { address, amount } = body;

  if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return withCors(errorResponse('Invalid or missing "address" (expected 0x-prefixed, 42 chars)', 400), request);
  }

  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return withCors(errorResponse('"amount" must be a positive number', 400), request);
  }

  // --- Generate CDP JWT ---
  if (!env.CDP_API_KEY_ID || !env.CDP_API_KEY_SECRET) {
    console.error('Missing CDP_API_KEY_ID or CDP_API_KEY_SECRET secrets');
    return withCors(errorResponse('Server configuration error', 500), request);
  }

  let jwt;
  try {
    jwt = await generateCdpJwt(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET);
  } catch (err) {
    console.error('JWT generation failed:', err.message);
    return withCors(errorResponse('Failed to generate authentication token', 500), request);
  }

  // --- Fetch onramp session token ---
  let tokenData;
  try {
    tokenData = await fetchOnrampToken(jwt, address);
  } catch (err) {
    console.error('Onramp token fetch failed:', err.message);
    return withCors(errorResponse('Failed to obtain onramp session token', 502), request);
  }

  return withCors(jsonResponse(tokenData), request);
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error('Unhandled error:', err);
      return withCors(errorResponse('Internal server error', 500), request);
    }
  },
};
