# Security Model

## Admin Override Operations

The contract exposes three admin-only entrypoints that mirror the sender-facing
lifecycle operations: `admin_pause`, `admin_resume`, and `admin_cancel`.

### Authentication Guarantees

- Every admin entrypoint calls `admin.require_auth()` before any state mutation.
- Any caller that is not the initialized admin address will receive an
  `Unauthorized` / `NotAdmin` error. There is no fallback or bypass path.
- Spoofed or unrelated addresses are rejected identically to non-admin callers.

### Terminal State Protections

Once a stream reaches a terminal state it cannot be mutated by any caller,
including the admin.

| Terminal State | admin_pause | admin_resume | admin_cancel |
|----------------|-------------|--------------|--------------|
| Cancelled      | ❌ Fails (`StreamTerminated`) | ❌ Fails | ❌ Fails |
| Completed      | ❌ Fails (`StreamTerminated`) | ❌ Fails | ❌ Fails |
| Expired (time) | ❌ Fails    | ❌ Fails     | Matches sender path |

### Admin Override Limitations

| Stream State | admin_pause | admin_resume | admin_cancel |
|--------------|-------------|--------------|--------------|
| Active       | ✅ → Paused  | ❌ `StreamNotPaused` | ✅ → Cancelled |
| Paused       | ❌ `StreamAlreadyPaused` | ✅ → Active | ✅ → Cancelled |
| Terminal     | ❌ `StreamTerminated` | ❌ `StreamTerminated` | ❌ `StreamTerminated` |

### Semantic Consistency

Admin override entrypoints produce identical final states to their sender
counterparts:

- `admin_pause` ≡ `pause_stream` (resulting state: `Paused`)
- `admin_resume` ≡ `resume_stream` (resulting state: `Active`)
- `admin_cancel` ≡ `cancel_stream` (resulting state: `Cancelled`)

The only difference is the authentication check: admin overrides authenticate
against the admin address, while sender operations authenticate against the
stream's original sender.

### Missing Stream Handling

Calling any admin entrypoint with a non-existent `stream_id` returns
`StreamNotFound` without panicking. No storage is written on failure paths.

## Frontend Browser Hardening

The SPA includes a baseline Content-Security-Policy meta tag in `index.html`
plus a `strict-origin-when-cross-origin` referrer policy. The meta policy keeps
runtime code and static assets on the application origin, blocks object/frame
embedding, permits HTTPS/WSS connections for the configured API and Soroban RPC
endpoints, allows the current Google Fonts stylesheet/font pair, and avoids
`unsafe-eval`.

### Freighter and RPC Compatibility

- Freighter browser-extension content scripts are not loaded as page scripts, so
  the page CSP does not need a broad `chrome-extension:` script allow-list.
- Transaction submission and polling use `VITE_RPC_URL`; hosted environments
  should narrow `connect-src` to the exact API and RPC origins they deploy with.
- Local Vite development keeps `ws://localhost:*` and `ws://127.0.0.1:*` in
  `connect-src` so hot-module reload can connect while testing the same HTML.

### Recommended Host Headers

Meta CSP cannot enforce `frame-ancestors`, and `X-Frame-Options` has no meta-tag
equivalent. Production hosts or reverse proxies should send these headers with
the HTML response:

```http
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.fluxora.app https://soroban-testnet.stellar.org https://soroban-mainnet.stellar.org https://horizon-testnet.stellar.org https://horizon.stellar.org; form-action 'self'; manifest-src 'self'; worker-src 'self'; upgrade-insecure-requests
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

If Fluxora is deployed with a custom `VITE_API_URL` or `VITE_RPC_URL`, replace
the example `connect-src` origins with those exact HTTPS endpoints. Keep
`frame-ancestors 'none'` unless an explicitly trusted embedding surface is
introduced and reviewed.
