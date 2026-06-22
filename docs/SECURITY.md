# Security

This document summarizes production-safe security expectations for Forge Resume.

## Core rules

- do not commit secrets
- do not expose server-side AI keys in frontend code
- do not place Firebase Admin credentials in client environment variables
- treat AI output as untrusted until reviewed by the user

## Client vs server secrets

## Firebase web config

These values are expected in client-side environment variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

These are public app configuration values, not admin secrets.

## Server-side AI keys

Forge Free Beta AI provider keys should stay server-side only.

Examples:

- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `CEREBRAS_API_KEY`

They should never be exposed through frontend source, client env naming, or user-visible debug output.

## BYOK handling

BYOK is intended to be separate from Forge-managed provider keys.

Production-safe expectations:

- do not log user keys
- do not expose them to other users
- minimize persistence
- treat them as user secrets

## Upstash quota protection

Forge Free Beta AI quota control depends on Upstash Redis REST.

Relevant environment variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `AI_ABUSE_HASH_SALT`

Current documented behavior:

- device and IP identifiers are hashed before use in quota control
- global and import-specific counters help limit abuse
- safe status messages should be returned instead of raw infrastructure details

## Firebase user data

Signed-in user data is expected to remain owner-scoped through Firebase and Firestore rules.

Production-safe expectations:

- users should not read or overwrite other users’ resumes
- guest data should not silently merge into another account
- admin credentials must not be used in the browser

## No raw secrets in the frontend

Do not place these in client code or `VITE_` variables:

- Firebase Admin private key
- provider API keys used for Forge Free Beta AI
- Upstash REST token
- abuse-hash salt

## Responsible AI note

AI assistance should be treated as decision support, not ground truth.

Users should verify:

- names
- employers
- dates
- links
- claims or metrics introduced by rewrites

## Reporting concerns

If you suspect a secret leak or security issue:

1. rotate exposed credentials
2. remove secrets from the affected environment or commit history
3. redeploy after updating environment variables
4. audit logs and access rules where applicable

## Related docs

- [Setup](./SETUP.md)
- [AI](./AI.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
