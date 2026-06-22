# Troubleshooting

## Forge Free Beta AI unavailable

Possible causes:

- `AI_FREE_BETA_ENABLED` is not `true`
- no server-side provider key is configured
- the deployment environment was not redeployed after env changes
- the free AI route is temporarily disabled

Check:

- deployment environment variables
- the app’s AI status surface
- server logs for safe route-level failures

## Upstash quota store not configured

Symptoms:

- AI status reports quota store missing
- Forge Free Beta AI stays unavailable even with provider keys set

Check:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `AI_ABUSE_HASH_SALT`

After fixing env values, redeploy.

## Provider keys missing

Symptoms:

- free AI status shows provider setup missing
- import or writing actions stay disabled or unavailable

Check server variables:

- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `CEREBRAS_API_KEY`

## Firebase permission or setup issue

Symptoms:

- sign-in fails
- resumes do not load or save
- Firestore operations fail for signed-in users

Check:

- Firebase project config values
- enabled auth providers
- deployed Firestore rules
- correct Firebase project selected for the environment

## Import extraction issue

### PDF import is weak

Try:

- a PDF with selectable text
- the original DOCX file
- paste text import
- image import for scanned pages

### DOCX import fails

Try:

- re-exporting the DOCX from the source editor
- using pasted text if the DOCX is highly custom or corrupted

### Image import is unclear

Try:

- a sharper image
- better contrast
- a cropped image focused on the resume page

## PDF export issue

Symptoms:

- export fails
- preview looks different than expected
- long content may feel dense

Try:

- reducing unusually long sections or raw URLs
- checking the live preview before exporting again
- rebuilding the app after dependency installation if the environment is new

## Vercel env change not taking effect

Common cause:

- environment variables were changed without a redeploy

Fix:

1. update env values in Vercel
2. trigger a new deployment
3. re-test the affected route or UI

## Local app starts but Firebase setup screen appears

This usually means one or more `VITE_FIREBASE_*` values are missing.

Check:

- `.env.local` exists
- values are spelled correctly
- the dev server was restarted after editing env vars

## Build issues after cloning

Run:

```bash
npm install
npm run build
```

If build still fails:

- verify Node.js version
- verify `.env.local` usage only where needed
- check that optional server env variables are not being assumed locally

## Related docs

- [Setup](./SETUP.md)
- [AI](./AI.md)
- [Import / Export](./IMPORT_EXPORT.md)
