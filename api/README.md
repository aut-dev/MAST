# MAST Onramp API (Cloudflare Worker)

Cloudflare Worker that generates authenticated Coinbase Onramp session tokens. It acts as a secure backend proxy so that CDP credentials never reach the client.

## How it works

1. Client sends a POST request with a wallet address and bearer token
2. Worker validates the API key and rate-limits by IP
3. Worker signs a JWT using the CDP Ed25519 credentials
4. Worker calls the Coinbase Onramp `/v1/token` endpoint
5. Worker returns the session token to the client

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare Workers CLI)
- A Coinbase Developer Platform (CDP) API key with Ed25519 signature algorithm
- A self-generated API key to protect your endpoint

## Setup

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create `wrangler.toml`

Create a `wrangler.toml` file in this directory:

```toml
name = "mast-onramp-api"
main = "worker.js"
compatibility_date = "2024-12-01"

# Optional: specify your Cloudflare account ID
# account_id = "your-account-id"
```

### 4. Configure secrets

The worker requires three secrets. Set each one with Wrangler:

```bash
# Your own API key for authenticating callers to this worker
wrangler secret put MAST_API_KEY
# Paste your chosen API key when prompted

# Coinbase CDP API Key ID (looks like: organizations/{org}/apiKeys/{key})
wrangler secret put CDP_API_KEY_ID
# Paste the key name/ID when prompted

# Coinbase CDP API Key Secret (base64-encoded Ed25519 key)
wrangler secret put CDP_API_KEY_SECRET
# Paste the base64-encoded secret when prompted
```

To generate a strong random API key for `MAST_API_KEY`:

```bash
openssl rand -hex 32
```

### 5. Deploy

```bash
wrangler deploy
```

Wrangler will output the deployed URL, e.g.:

```
https://mast-onramp-api.<your-subdomain>.workers.dev
```

## Local development

```bash
# Start a local dev server
wrangler dev

# You can also set secrets for local dev via a .dev.vars file (git-ignored):
# MAST_API_KEY=test-key-123
# CDP_API_KEY_ID=organizations/abc/apiKeys/xyz
# CDP_API_KEY_SECRET=<base64-encoded-secret>
```

Create `.dev.vars` in this directory for local development secrets. This file should never be committed.

## API usage

### Endpoint

```
POST https://mast-onramp-api.<your-subdomain>.workers.dev
```

### Headers

| Header          | Value                     |
|-----------------|---------------------------|
| Content-Type    | `application/json`        |
| Authorization   | `Bearer <MAST_API_KEY>`   |

### Request body

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": 5
}
```

| Field     | Type   | Required | Description                        |
|-----------|--------|----------|------------------------------------|
| `address` | string | yes      | 0x-prefixed Ethereum address (42 chars) |
| `amount`  | number | no       | Amount in USD (positive number)    |

### Response (200)

The response body is the raw JSON returned by the Coinbase Onramp API:

```json
{
  "token": "eyJ..."
}
```

### Error responses

| Status | Meaning                            |
|--------|------------------------------------|
| 400    | Invalid JSON body or bad parameters|
| 401    | Missing Authorization header       |
| 403    | Invalid API key                    |
| 405    | Method not allowed (must be POST)  |
| 429    | Rate limited (10 req/min per IP)   |
| 500    | Server configuration error         |
| 502    | Coinbase API request failed        |

All errors return JSON:

```json
{
  "error": "Human-readable error message"
}
```

## CORS

The worker only allows requests from configured origins. To add more origins, edit the `ALLOWED_ORIGINS` array at the top of `worker.js`:

```js
const ALLOWED_ORIGINS = [
  'https://aut-dev.github.io',
  // Add more origins here:
  // 'https://your-domain.com',
];
```

## Rate limiting

The worker implements simple in-memory rate limiting at 10 requests per minute per IP address. Since Cloudflare Workers are distributed, each isolate maintains its own counter. This provides basic protection but is not a hard global limit. For stricter rate limiting, consider using [Cloudflare Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/).

## Security notes

- CDP credentials never leave the worker; only the session token is returned to the client
- The `MAST_API_KEY` secret ensures only your frontend can call the worker
- All secrets are stored encrypted via Cloudflare Workers Secrets (not in code or env vars)
- The JWT signed for Coinbase expires after 120 seconds
- Session tokens from Coinbase are single-use and short-lived

## Obtaining CDP API keys

1. Go to the [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
2. Create or select a project
3. Navigate to API Keys
4. Create a new API key, selecting **Ed25519** as the signature algorithm
5. Save the **Key Name** (this is your `CDP_API_KEY_ID`) and the **API Key Secret** (base64-encoded, this is your `CDP_API_KEY_SECRET`)
