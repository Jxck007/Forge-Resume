<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Forge Resume

## Run Locally

**Prerequisites:** Node.js and a Firebase web app.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Firebase web app values to `.env.local`.
4. Enable Email/Password and Google authentication in Firebase Authentication.
5. Deploy `firestore.rules` to the configured Firebase project.
6. Start the app with `npm run dev`.

Never commit `.env`, `.env.local`, or production environment files.
