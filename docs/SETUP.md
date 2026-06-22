# Setup

This guide covers a production-safe local setup for Forge Resume.

## Prerequisites

Install and configure:

- Node.js 20+ recommended
- npm
- a Firebase project with a Web App configured
- optional Vercel project for deployment
- optional Upstash Redis REST instance for Forge Free Beta AI quota control

## Install dependencies

```bash
npm install
```

## Create local environment file

```bash
cp .env.example .env.local
```

Never commit `.env.local`.

## Required Firebase client variables

Set these in `.env.local`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Optional:

```env
VITE_APP_VERSION=beta
```

## Optional Forge Free Beta AI variables

Enable server-side free AI only if you intend to run the AI routes:

```env
AI_FREE_BETA_ENABLED=false
GEMINI_API_KEY=
GROQ_API_KEY=
CEREBRAS_API_KEY=
```

Notes:

- `AI_FREE_BETA_ENABLED=true` turns on the server-side free AI path.
- At least one provider key is needed for Forge Free Beta AI to become available.
- Image import depends on Gemini availability.

## Optional Upstash quota variables

Forge Free Beta AI quota protection depends on Upstash Redis REST and a hashing salt:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
AI_ABUSE_HASH_SALT=
```

If these are missing:

- Forge Free Beta AI should report quota store unavailability
- normal non-AI app flows can still work

## Optional Firebase Admin variables

Some server-side flows may expect Firebase Admin credentials.

```env
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

For local files, keep the private key newline-escaped if needed.

## Run locally

```bash
npm run dev
```

Default Vite dev server behavior is defined by the repo’s current config.

## Build locally

```bash
npm run build
```

## Firebase setup checklist

In Firebase Console:

1. Create a Web App
2. Copy the Firebase web config values into `.env.local`
3. Enable the auth providers you need, typically:
   - Email/Password
   - Google
4. Deploy Firestore rules before production use

## Vercel deployment

1. Import the repo into Vercel
2. Add all required environment variables in the Vercel project
3. Deploy
4. Verify:
   - frontend loads Firebase correctly
   - auth works
   - PDF export works
   - AI status route behaves as expected

## Important redeploy reminder

After changing environment variables in Vercel or any other deployment target:

- **redeploy the app**

Runtime environment changes do not always appear in existing deployments automatically.

## Recommended first verification steps

After setup:

- sign in and create a resume
- test guest mode
- test PDF export
- if AI is enabled, open AI Assist and check status
- if Upstash is enabled, confirm `/api/ai/status` shows quota availability

## Related docs

- [README](../README.md)
- [AI](./AI.md)
- [Import / Export](./IMPORT_EXPORT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
