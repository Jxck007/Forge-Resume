# Forge Resume

> AI-assisted resume builder focused on clean editing, live preview, and reliable PDF export.

## Beta status

Forge Resume is currently in **beta**.

Please expect active iteration around AI-assisted import, export polish, and operational hardening. AI output can be wrong, incomplete, or overly confident, so all AI-generated results should be reviewed before saving or applying them.

## Live demo

- Production app: `TODO: add deployed URL`
- Vercel preview deployments: available per deployment environment

## Screenshots

Screenshots can be added under [`docs/assets/`](docs/assets/README.md).

## Current production scope

Forge Resume currently focuses on the core resume workflow:

- create a resume from scratch
- edit structured resume content
- preview the rendered document live
- export a text-based PDF
- use guest mode for local-only work
- sign in for cloud-saved resumes
- use optional AI assistance with review-before-apply controls
- import existing resume content through the beta import flow

> **Important:** ATS is **paused** in the visible product. Legacy ATS code remains in the repository, but the active app should not be documented as a live ATS scoring product.

## Features

### Resume workspace

- Dashboard for create, import, template selection, and resume management
- Resume Builder with structured sections
- Live preview driven by the production PDF renderer
- Multiple resume templates
- Guest mode with local-only persistence
- Signed-in mode with Firebase-backed resume storage

### AI assistance

- **Forge Free Beta AI** with server-side provider access
- **BYOK AI** for users who want to connect their own provider for the current browser session
- Review-before-apply workflow for AI writing suggestions
- Import review before a parsed resume is saved
- Safe fallback messaging when AI is unavailable

### Import / export

- AI-assisted import for:
  - pasted text
  - PDF
  - DOCX
  - image files
- Review screen before saving an imported resume
- PDF export using `@react-pdf/renderer`
- Other export formats may appear in the UI as planned or disabled states, but PDF is the current production export path

## Tech stack

- React 19
- TypeScript
- Vite
- Firebase Auth
- Firestore
- React PDF (`@react-pdf/renderer`)
- `pdfjs-dist`
- `mammoth`
- Vercel serverless API routes
- Upstash Redis REST for AI quota protection

## Architecture overview

```text
Dashboard / Builder / Preview
  -> normalized resume data
  -> React state + guest/user persistence
  -> ResumePreview
  -> ResumePdfDocument
  -> PDF export

AI writing help
  -> client review flow
  -> /api/ai/action
  -> server-side provider selection
  -> user approval before apply

Resume import beta
  -> local extraction or image preparation
  -> /api/ai/import
  -> normalized import result
  -> review screen
  -> save as resume draft
```

Helpful repository references:

- Current app snapshot: [`docs/FORGE_CURRENT_STATE.md`](docs/FORGE_CURRENT_STATE.md)
- Internal app analysis: [`docs/FORGE_APP_ANALYSIS.md`](docs/FORGE_APP_ANALYSIS.md)
- Setup guide: [`docs/SETUP.md`](docs/SETUP.md)
- AI guide: [`docs/AI.md`](docs/AI.md)
- Import/export guide: [`docs/IMPORT_EXPORT.md`](docs/IMPORT_EXPORT.md)
- Security notes: [`docs/SECURITY.md`](docs/SECURITY.md)
- Troubleshooting: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)

## AI features

Forge Resume supports two AI modes:

### Forge Free Beta AI

- optional server-side AI assistance
- protected by quota limits and abuse controls
- intended for summary improvement, bullet rewrites, grammar help, and import structuring
- uses provider availability checks before enabling actions

### BYOK AI

- lets the user connect their own provider in the app
- intended to be session-scoped rather than a permanent stored secret
- remains separate from Forge Free Beta quota usage

See [`docs/AI.md`](docs/AI.md) for details.

## Import / export support

### Import

Current beta import flow is designed for **signed-in use** and supports:

- paste text
- PDF
- DOCX
- image files

Imported content is reviewed before it becomes a saved resume.

### Export

Current production export path:

- PDF export

Planned or non-primary export formats should not be treated as production-ready unless verified in the running app.

See [`docs/IMPORT_EXPORT.md`](docs/IMPORT_EXPORT.md).

## Security and privacy notes

- Do not commit `.env.local` or real secrets.
- Firebase client keys are public app configuration values, not admin secrets.
- Server-side AI provider keys must stay on the server.
- AI responses may be inaccurate and should be reviewed by the user.
- Guest mode is local-only.
- Signed-in resume storage depends on Firebase rules and owner-scoped access.
- Upstash quota logic uses hashed device/IP identifiers for abuse protection.

See [`docs/SECURITY.md`](docs/SECURITY.md).

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Full setup instructions: [`docs/SETUP.md`](docs/SETUP.md)

## Environment variables

The app currently uses environment variables for:

- Firebase web app config
- optional app version label
- Forge Free Beta AI toggle
- server-side provider keys
- Upstash quota store
- optional Firebase Admin server credentials

Use the placeholder file:

- [`.env.example`](.env.example)

## Vercel deployment notes

- Frontend and API routes are designed for Vercel deployment
- add required environment variables in the Vercel project settings
- redeploy after changing environment variables
- verify both client Firebase config and server API env values in the target environment

## Firebase notes

- Firebase Auth is used for signed-in mode
- Firestore stores user resumes and related app data
- guest mode should continue to work without account creation
- deploy Firestore rules before production use

## Upstash notes

Upstash is used for Forge Free Beta AI quota and abuse protection.

Current documented responsibilities:

- device/IP/global request limiting
- separate import quota tracking
- reset windows for limited free usage
- safe availability reporting through `/api/ai/status`

If Upstash is not configured, Forge Free Beta AI should report that clearly rather than silently failing.

## Troubleshooting

See [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

## Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

License file not added yet.

Suggested placeholder: `TBD` until the repository owner chooses an open-source or proprietary license.
