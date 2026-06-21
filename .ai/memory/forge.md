# Forge Resume Memory

Forge Resume is ATS-first, AI-assisted resume builder.

Core rules:
- One normalized resume model.
- Builder, Preview, PDF, ATS, Parser, Firebase must share same source of truth.
- Firebase Spark only.
- No Cloud Functions.
- Guest mode must not leak into user account.
- React PDF current renderer.
- Prepare Typst architecture only, do not migrate yet.
- AI is optional and replaceable.

Storage notes:
- Guest draft now persists only under forgeResume:guest:* keys.
- User draft/profile/editor state persists only under forgeResume:user:{uid}:* keys.
- Guest drafts must never auto-import into accounts; login only shows a future-import placeholder notice.

ATS truth notes:
- Structural V2 scoring is local and deterministic.
- AI stages use explicit ready/needs_ai/error states and nullable scores.
- AI runs only from a user-triggered ATS scan, never reactively on edits.
- Legacy local heuristic details remain available only in a collapsed disclosure.

UI trust notes:
- Workspace/auth loading uses no simulated percentage or progress bar.
- ATS stage statuses are ready/partial/needs_ai/needs_job_description/not_run/error.
- Feedback uses one Firestore write when available, scoped local fallback, copy, and mailto actions.

ATS reset notes (2026-06-20):
- Active /ats route still uses ATSAnalyzer with legacy local metrics plus V2.
- Canonical replacement contracts live under src/ats/core; local readability adapter lives under src/ats/local-readability.
- Local readability excludes app/mobile/tablet responsiveness and is explicitly not a full ATS scan.
- AI Job Match must require both a configured provider and target job description.

ATS honesty notes (2026-06-20):
- Active ATS UI shows Local Resume Readability as a rating without a local numeric final score.
- Job Match and Content Upgrade use explicit needs_ai/needs_job_description gates; Apply stays not_run without suggestions.
- Legacy heuristic score/history values and responsiveness panels are hidden from user view but code remains for migration.
- Local phone validation is optional unless a phone value is provided.

ATS pause notes (2026-06-20):
- Visible ATS product entry points are paused in the UI layer.
- Header/dashboard/settings/builder no longer expose ATS actions or ATS-branded copy.
- Direct `/ats` visits show a paused message and route users back to dashboard or builder.
- Legacy ATS code is intentionally kept in the repo for adapter-first rebuild later.

AI Job Match notes (2026-06-20):
- Canonical provider/JD gate and validated execution live in src/ats/ai-job-match.
- AI contract now requires suggestion ids plus grammar/spelling arrays; V2 consumes only validated payloads.
- Keyword evidence classification prevents direct application when evidence is absent.
- Suggestion UI supports Apply, Edit Before Applying, Ignore, Mark as Not True, and Learning Targets.

UI simplification notes (2026-06-20):
- First-run tutorial completion is scoped to guest/user storage and can be restarted from the header Help action.
- Mobile builder uses explicit Editor/Preview tabs; desktop keeps the split layout.
- Builder, preview, profile, and settings are lazy-loaded; the PDF renderer is no longer part of the initial route bundle.
- Import loading no longer displays simulated percentages.
- Google authentication now synchronously blocks guest entry while its popup is pending, preventing an auth/guest race.
- The first-run guide spotlights real Dashboard action buttons and the persistent Help control instead of using generic tutorial-only cards.
- Resume creation now presents scratch/import/profile starting paths plus selectable John Doe previews for every template.
- Guest import shows only a sign-in requirement and the formats available after sign-in; disabled upload controls are hidden.
- Imported resumes retain the template selected before entering the import flow.
- Builder no longer exposes the heuristic “Live Language Intelligence” score or grammar claims.
- AI rewrite controls render only when a provider key is actually configured; guest/no-key editing remains plain and honest.
- Template selection now lives in a Dashboard showcase; there is no Templates navigation route.
- Dashboard “Choose Template” opens a modal gallery; the selected complete John Doe sample renders automatically through the production React-PDF pipeline with a visible loading state.
- The create dialog reuses the showcase selection and only asks whether to start from scratch, import, or profile.
- Account-scoped Settings now include template, export, link, section-order, and profile-photo defaults plus a restartable scoped Settings tour.
- Header Help is contextual: Dashboard, Builder, Profile, and Settings launch page-specific spotlight guides.
- Spotlight tours use a shared pointer-transparent layer so highlighted background controls remain usable; mobile guidance is a bottom card.
- Current architecture and pre-AI risks are documented in docs/FORGE_CURRENT_STATE.md.
- Phase 1 cleanup hides visible AI Provider settings, moves feedback under the Help menu, removes Dashboard export CTA, relabels signed-in import as Import Resume Beta, and keeps ATS paused/hidden.

BYOK AI Assist notes (2026-06-20):
- Gemini, Groq, and Cerebras use one session-memory provider context; keys are never persisted and are cleared on refresh/unmount, logout, account switch, guest transition, provider switch, local-mode switch, and Forget key.
- Guest Builder shows only a sign-in notice; working AI actions and key entry remain signed-in only.
- Builder sends only the selected field, requires Apply/Copy/Discard review, rejects stale field responses, caps input/output, and enforces cooldown.
- Import Resume Beta supports signed-in BYOK pasted text only; guest and file-based AI imports remain paused.
- Legacy settings-key AI execution is neutralized and cannot read old provider fields or place keys in URLs.
- OpenRouter joins Gemini, Groq, and Cerebras through the same memory-only adapter boundary; provider/model failures use safe typed copy and all AI requests share one in-flight lock.
- User settings writes use sanitized Firestore `setDoc(..., { merge: true })`, so missing user documents no longer fail with `No document to update`.
- Header avatars use the saved profile photo when available; mobile navigation, resume action menus, Settings, and the template chooser have viewport-safe layouts.
- Guided tours render in a body portal and inert the app shell, so only Skip/Back/Next/Finish controls are interactive during a tour.
- Main navigation exposes Profile; the avatar menu contains Settings and Logout, and Profile has its own Logout action.
- Builder shows compact provider-ready status, supports STAR/impact rewrite styles, and keeps every AI result behind Apply/Copy/Discard review.
- Groq uses `max_tokens`; Cerebras keeps `max_completion_tokens`; successful connection tests preserve the exact tested model.
- Gemini QA follow-up uses a minimal REST `contents[].parts[].text` request with `x-goog-api-key`, safe 2.5 Flash defaults, and no key in the URL.
- Builder Preview exposes Export PDF plus a compact disabled coming-soon menu for DOCX, PNG, and JSON; the visible Print action was removed.
- At 360px the header preserves the emblem, `Forge`, and the visible Beta badge while hiding only the secondary `Resume` word.
- Forge Free AI availability now comes only from authenticated `/api/ai/status` and `/api/ai/action`; Admin-only reads cover `aiSystem`, `aiUsage`, and `aiAbuse`, while missing config defaults to enabled when the server env flag and provider keys are present.
- Import Resume Beta defaults to compact pasted-text input; PDF, DOCX, and image controls are disabled and labeled Coming soon.
